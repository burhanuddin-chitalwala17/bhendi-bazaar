import { encryptSecret } from "@server/shared/crypto";
import { appUrl } from "@server/shared/app-url";
import { prisma } from "@server/shared/prisma";
import { uniqueViolationFields } from "@server/shared/constraint";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { isSocialOpen } from "./channel-availability";
import { channelConnectionRepository } from "./channel-connection.repository";
import { CONNECT_RESULT, CONNECTION_STATE, type ConnectResult } from "./channel-connection.types";
import { socialPlan } from "./channel-plan";
import { CONNECT_PURPOSE, signConnectState, verifyConnectState, type ConnectState, type StateCheck } from "./connect-state";
import { MetaError } from "./providers/meta/errors";
import { INSTAGRAM_ACCOUNT, instagramLogin, type InstagramLogin } from "./providers/meta/instagram-login";
import { SOCIAL_ERROR, SOCIAL_PLATFORM } from "./social/types";

/**
 * Connecting a shop's Instagram professional account (connect-instagram D1): the consent link, and
 * the return, which stores the 60-day token sealed only for a business or creator account that no
 * other shop holds. Instagram's answers never reach the person; outcomes are `CONNECT_RESULT` codes.
 */

const CHANNEL = SOCIAL_PLATFORM.INSTAGRAM;
export const instagramCallbackUrl = () => `${appUrl()}/api/channels/instagram/callback`;

/** Expired access is a link to start again; anything else Instagram did is "didn't respond". */
function outcomeOf(error: unknown): ConnectResult {
  if (error instanceof MetaError) return error.code === SOCIAL_ERROR.AUTH ? CONNECT_RESULT.EXPIRED : CONNECT_RESULT.UNREACHABLE;
  throw error;
}

export function instagramConnectService(login: InstagramLogin = instagramLogin()) {
  return {
    async start(orgId: string, userId: string): Promise<{ redirectTo: string } | { result: ConnectResult }> {
      await socialPlan.assert(orgId);
      if (!isSocialOpen(CHANNEL)) return { result: CONNECT_RESULT.UNAVAILABLE };
      const existing = await channelConnectionRepository.find(orgId, CHANNEL);
      const live = existing !== null && existing.state !== CONNECTION_STATE.DISCONNECTED;
      const state = signConnectState({ orgId, userId, channel: CHANNEL, purpose: live ? CONNECT_PURPOSE.RECONNECT : CONNECT_PURPOSE.CONNECT });
      return { redirectTo: login.consentUrl(state, instagramCallbackUrl()) };
    },

    /** Read before anything is trusted; the route checks the signed-in member against it (R2). */
    readReturn(params: URLSearchParams): { consent: ReturnType<InstagramLogin["readReturn"]>; check: StateCheck } {
      const consent = login.readReturn(params);
      return { consent, check: verifyConnectState(consent.state) };
    },

    async complete(state: ConnectState, consent: { code: string | null; declined: boolean }, now = new Date()): Promise<ConnectResult> {
      // A state signed for another channel is never spent here.
      if (state.channel !== CHANNEL) return CONNECT_RESULT.EXPIRED;
      if (consent.declined || !consent.code) return CONNECT_RESULT.CANCELLED;
      const { orgId, userId, purpose } = state;
      await socialPlan.assert(orgId);
      // Closed in the ten minutes since the link was made: nothing is exchanged.
      if (!isSocialOpen(CHANNEL)) return CONNECT_RESULT.UNAVAILABLE;

      let token: string;
      let expiresAt: Date;
      let account: Awaited<ReturnType<InstagramLogin["account"]>>;
      try {
        ({ accessToken: token, expiresAt } = await login.exchange(consent.code, instagramCallbackUrl(), now));
        account = await login.account(token);
      } catch (error) {
        return outcomeOf(error);
      }
      // Nothing is stored for a personal account: its token is dropped here (R3).
      if (account.type === INSTAGRAM_ACCOUNT.PERSONAL) return CONNECT_RESULT.PERSONAL;

      let result: ConnectResult = CONNECT_RESULT.CONNECTED;
      try {
        await prisma.$transaction(async (tx) => {
          await channelConnectionRepository.lockFor(tx, orgId, CHANNEL);
          const existing = await channelConnectionRepository.find(orgId, CHANNEL, tx);
          const live = existing !== null && existing.state !== CONNECTION_STATE.DISCONNECTED;
          // Switching accounts is disconnect, then connect (Q4).
          if (live && existing.externalAccountId && existing.externalAccountId !== account.accountId) {
            result = CONNECT_RESULT.DIFFERENT_ACCOUNT;
            return;
          }
          if (await channelConnectionRepository.liveElsewhere(CHANNEL, account.accountId, orgId, tx)) {
            result = CONNECT_RESULT.OTHER_SHOP;
            return;
          }
          const { id } = await channelConnectionRepository.connectSocial(tx, {
            orgId,
            channel: CHANNEL,
            externalAccountId: account.accountId,
            username: account.username,
            accountKind: account.type,
            accessToken: encryptSecret(token),
            accessTokenExpiresAt: expiresAt,
            userId,
            now,
          });
          await recordAdminActionIn(tx, {
            adminId: userId,
            action: purpose === CONNECT_PURPOSE.RECONNECT ? "channel.reconnect" : "channel.connect",
            resource: "ChannelConnection",
            resourceId: id,
            metadata: { orgId, channel: CHANNEL, accountType: account.type },
          });
        });
      } catch (error) {
        // Connects for one shop are serialised by `lockFor`, so only the one-shop-per-account index can refuse here.
        if (uniqueViolationFields(error) !== null) return CONNECT_RESULT.OTHER_SHOP;
        throw error;
      }
      if (result !== CONNECT_RESULT.CONNECTED) return result;

      // Best effort: the connection stands without it, and the daily pass subscribes again.
      await login.subscribe(token).catch((error: unknown) => {
        console.error(JSON.stringify({ scope: "channels.instagram", step: "subscribe", orgId, error: error instanceof MetaError ? error.code : "error" }));
      });
      return CONNECT_RESULT.CONNECTED;
    },
  };
}

export const instagramConnect = instagramConnectService();
