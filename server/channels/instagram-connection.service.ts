import { decryptSecret, encryptSecret, needsReencryption } from "@server/shared/crypto";
import { NotFoundError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { channelConnectionRepository, type SecretRow } from "./channel-connection.repository";
import { CONNECTION_ERROR, CONNECTION_STATE } from "./channel-connection.types";
import { socialPlan } from "./channel-plan";
import { MetaError } from "./providers/meta/errors";
import { INSTAGRAM_TOKEN_DAYS, instagramLogin, type InstagramLogin } from "./providers/meta/instagram-login";
import { SOCIAL_ERROR, SOCIAL_PLATFORM } from "./social/types";

/**
 * Keeping an Instagram connection alive and ending it (connect-instagram D2, D4, D5): the daily pass
 * that renews the 60-day token and checks the account, Check now, and disconnect. The marketplaces'
 * pass skips social rows on purpose (Q17), so this is Instagram's own.
 */

const CHANNEL = SOCIAL_PLATFORM.INSTAGRAM;
const DAY_MS = 86_400_000;
/** Renewed once older than this; refreshing at 7 days of 60 leaves 53 days of daily retries (Q6). */
const RENEW_AFTER_DAYS = 7;
/** Check now answers from the last check this recent, so tapping it cannot spend the account's Meta budget. */
export const CHECK_NOW_GAP_MS = 60_000;

export type CheckOutcome = "ok" | "needs_reconnect" | "unreachable";
export interface UpkeepSummary {
  checked: number;
  renewed: number;
  resealed: number;
  needsReconnect: number;
  unreachable: number;
  skipped: number;
  locked: number;
}

const renewalDue = (row: Pick<SecretRow, "accessTokenExpiresAt">, now: Date) =>
  !row.accessTokenExpiresAt || row.accessTokenExpiresAt.getTime() - now.getTime() < (INSTAGRAM_TOKEN_DAYS - RENEW_AFTER_DAYS) * DAY_MS;

const codeOf = (error: unknown) => (error instanceof MetaError ? error.code : "error");
const log = (step: string, id: string, error: unknown) =>
  console.error(JSON.stringify({ scope: "channels.instagram", step, connection: id, error: codeOf(error) }));

export function instagramConnectionService(login: InstagramLogin = instagramLogin()) {
  /** Our access is gone: the card asks the shop to reconnect (R8). Conditional, so a disconnect stays one. */
  const lost = (id: string, now: Date) => channelConnectionRepository.markNeedsReconnect(id, CONNECTION_ERROR.REVOKED, now);

  async function liveToken(orgId: string): Promise<{ id: string; token: string } | null> {
    const row = await channelConnectionRepository.secretsFor(orgId, CHANNEL);
    if (!row || row.state !== CONNECTION_STATE.CONNECTED || !row.accessToken) return null;
    return { id: row.id, token: decryptSecret(row.accessToken) };
  }

  /** One cheap read of the account, recorded; a lost token turns the card (Q8: the deauthorize call may never come). */
  async function checkOne(orgId: string, now: Date): Promise<CheckOutcome> {
    const live = await liveToken(orgId);
    if (!live) throw new NotFoundError("Connection");
    let account: Awaited<ReturnType<InstagramLogin["account"]>>;
    try {
      account = await login.account(live.token);
    } catch (error) {
      if (error instanceof MetaError && error.code === SOCIAL_ERROR.AUTH) {
        await lost(live.id, now);
        return "needs_reconnect";
      }
      if (error instanceof MetaError) return "unreachable";
      throw error;
    }
    await channelConnectionRepository.markChecked(live.id, now, { username: account.username, accountKind: account.type });
    return "ok";
  }

  /** Under the row lock: a second pass waits, then finds the token fresh; a disconnect finds nothing to renew. */
  async function renew(id: string, now: Date): Promise<"renewed" | "fresh" | "gone"> {
    return await prisma.$transaction(
      async (tx) => {
        const locked = await channelConnectionRepository.lockSecrets(tx, id);
        if (!locked || locked.state !== CONNECTION_STATE.CONNECTED || !locked.accessToken) return "gone";
        if (!renewalDue(locked, now)) return "fresh";
        const grant = await login.refresh(decryptSecret(locked.accessToken), now);
        await channelConnectionRepository.saveSocialToken(tx, id, { accessToken: encryptSecret(grant.accessToken), accessTokenExpiresAt: grant.expiresAt });
        return "renewed";
      },
      { timeout: 20_000 },
    );
  }

  /**
   * Idempotent at Meta; puts back a subscription the connect could not make (D1). A disconnect that
   * landed meanwhile already unsubscribed, so this one is taken back: every call stops (R10).
   */
  async function resubscribe(live: { id: string; token: string }): Promise<void> {
    try {
      await login.subscribe(live.token);
    } catch (error) {
      log("subscribe", live.id, error);
      return;
    }
    const after = await channelConnectionRepository.byId(live.id);
    if (after?.state === CONNECTION_STATE.DISCONNECTED) await login.unsubscribe(live.token).catch((error: unknown) => log("unsubscribe", live.id, error));
  }

  /** Re-seal under the current key after a key is added, without renewing (channel-connectors D3). */
  async function reseal(id: string): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      const locked = await channelConnectionRepository.lockSecrets(tx, id);
      if (!locked?.accessToken || locked.state !== CONNECTION_STATE.CONNECTED || !needsReencryption(locked.accessToken)) return false;
      await channelConnectionRepository.saveSocialToken(tx, id, {
        accessToken: encryptSecret(decryptSecret(locked.accessToken)),
        accessTokenExpiresAt: locked.accessTokenExpiresAt,
      });
      return true;
    });
  }

  return {
    /**
     * The daily pass (D2): renewal is free, whatever the shop's plan; the account check and the
     * webhook re-subscription only for shops holding Social selling. Suspended shops are skipped.
     */
    async maintain(isSuspended: (orgId: string) => Promise<boolean>, now = new Date()): Promise<UpkeepSummary & { failed: number }> {
      const summary = { checked: 0, renewed: 0, resealed: 0, needsReconnect: 0, unreachable: 0, skipped: 0, locked: 0, failed: 0 };
      const rows = await channelConnectionRepository.liveSocial(CHANNEL);
      const held = await socialPlan.allowed([...new Set(rows.map((r) => r.orgId))]);
      for (const row of rows) {
        try {
          if (await isSuspended(row.orgId)) {
            summary.skipped++;
            continue;
          }
          await this.maintainOne(row, held.has(row.orgId), summary, now);
        } catch (error) {
          // One bad row must not stop every other shop's renewal; the id is enough to find it.
          summary.failed++;
          log("maintain", row.id, error);
        }
      }
      return summary;
    },

    async maintainOne(row: SecretRow, held: boolean, summary: UpkeepSummary, now = new Date()): Promise<void> {
      if (row.state !== CONNECTION_STATE.CONNECTED) return;
      if (renewalDue(row, now)) {
        try {
          const outcome = await renew(row.id, now);
          if (outcome === "gone") return;
          if (outcome === "renewed") summary.renewed++;
        } catch (error) {
          if (error instanceof MetaError && error.code === SOCIAL_ERROR.AUTH) {
            await lost(row.id, now);
            summary.needsReconnect++;
            return;
          }
          // Instagram did not answer: the token has weeks left, and tomorrow's pass tries again.
          if (!(error instanceof MetaError)) throw error;
          log("renew", row.id, error);
        }
      }

      if (held) {
        const outcome = await checkOne(row.orgId, now);
        if (outcome === "ok") {
          summary.checked++;
          const live = await liveToken(row.orgId);
          if (live) await resubscribe(live);
        } else if (outcome === "needs_reconnect") {
          summary.needsReconnect++;
          return;
        } else summary.unreachable++;
      } else {
        summary.locked++;
      }

      if (await reseal(row.id)) summary.resealed++;
    },

    /** "Check now" (D4): answered from a check under a minute old rather than asking Instagram again. */
    async check(orgId: string, now = new Date()): Promise<CheckOutcome> {
      await socialPlan.assert(orgId);
      const row = await channelConnectionRepository.find(orgId, CHANNEL);
      if (!row || row.state !== CONNECTION_STATE.CONNECTED) throw new NotFoundError("Connection");
      if (row.lastCheckedAt && now.getTime() - row.lastCheckedAt.getTime() < CHECK_NOW_GAP_MS) return "ok";
      return await checkOne(orgId, now);
    },

    /** "Done" on the Turn on replies sheet (D3): the step waits for the first message. Free, as reads are. */
    async repliesAsked(orgId: string, now = new Date()): Promise<void> {
      const row = await channelConnectionRepository.find(orgId, CHANNEL);
      if (!row || !(await channelConnectionRepository.markRepliesAsked(row.id, now))) throw new NotFoundError("Connection");
    },

    /**
     * Meta answered a message read or send with "access to messages not allowed" (D3): the card says
     * so until the next message arrives. For inbox-instagram to call; nothing reads messages yet (Q19).
     */
    async messagesRefused(connectionId: string, now = new Date()): Promise<void> {
      await channelConnectionRepository.markMessagesOff(connectionId, now);
    },

    /**
     * Disconnect (D5, R10): webhooks stopped at Instagram (best effort), the token deleted, the record
     * kept as Disconnected with who and when. Free, as every disconnect is.
     */
    async disconnect(orgId: string, userId: string, now = new Date()): Promise<void> {
      const row = await channelConnectionRepository.secretsFor(orgId, CHANNEL);
      if (!row || row.state === CONNECTION_STATE.DISCONNECTED) throw new NotFoundError("Connection");
      // Before the token goes: it is the only thing that can ask Instagram to stop sending.
      if (row.accessToken) await login.unsubscribe(decryptSecret(row.accessToken)).catch((error: unknown) => log("unsubscribe", row.id, error));
      // The update waits on a renewal's row lock, then deletes what it wrote.
      await prisma.$transaction(async (tx) => {
        const done = await channelConnectionRepository.disconnect(tx, orgId, CHANNEL, userId, now);
        if (!done) throw new NotFoundError("Connection");
        await recordAdminActionIn(tx, {
          adminId: userId,
          action: "channel.disconnect",
          resource: "ChannelConnection",
          resourceId: done.id,
          metadata: { orgId, channel: CHANNEL },
        });
      });
    },
  };
}

export const instagramConnection = instagramConnectionService();
