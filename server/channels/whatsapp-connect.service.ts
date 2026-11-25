import { encryptSecret } from "@server/shared/crypto";
import { prisma } from "@server/shared/prisma";
import { uniqueViolationFields } from "@server/shared/constraint";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { isSocialOpen } from "./channel-availability";
import { channelConnectionRepository } from "./channel-connection.repository";
import { CONNECT_RESULT, CONNECTION_STATE, type ConnectResult, type WhatsAppNumberKind, type WhatsAppSignupStart } from "./channel-connection.types";
import { socialPlan } from "./channel-plan";
import { CONNECT_PURPOSE, newStateNonce, signConnectState, verifyConnectState, type ConnectState, type StateCheck } from "./connect-state";
import { MetaError } from "./providers/meta/errors";
import { embeddedSignup, type EmbeddedSignup } from "./providers/meta/embedded-signup";
import { SOCIAL_ERROR, SOCIAL_PLATFORM } from "./social/types";
import { whatsappSetupSpec } from "./whatsapp-setup.job";

/**
 * Connecting a shop's WhatsApp number through Meta's Embedded Signup (connect-whatsapp D1, D2): the
 * attempt the pop-up opens with, and its result, which claims the number Setting up and hands the
 * rest to the setup job. Meta's answers never reach the person; outcomes are `CONNECT_RESULT` codes.
 */

const CHANNEL = SOCIAL_PLATFORM.WHATSAPP;

/** What the pop-up posts back; untrusted until the state is spent and Meta confirms the ids. */
export interface SignupResult {
  code: string;
  businessId: string;
  phoneId: string;
  kind: WhatsAppNumberKind;
}

const START_AGAIN = new Set<string>([SOCIAL_ERROR.AUTH, SOCIAL_ERROR.REFUSED, SOCIAL_ERROR.PERMISSION]);
/** A sign-up attempt outlives Instagram's: coexistence onboarding, QR scan included, can pass ten minutes. */
const SIGNUP_TTL_MS = 30 * 60_000;
/** A failed setup holds nothing to keep: the shop may try again with any number (R6). */
const holdsNumber = (state: string) => state !== CONNECTION_STATE.DISCONNECTED && state !== CONNECTION_STATE.SETUP_FAILED;

function outcomeOf(error: unknown): ConnectResult {
  // A spent or foreign code, or an account the token cannot reach, is Meta refusing: start again, not "try later".
  if (error instanceof MetaError) return START_AGAIN.has(error.code) ? CONNECT_RESULT.EXPIRED : CONNECT_RESULT.UNREACHABLE;
  throw error;
}

export function whatsappConnectService(signup: EmbeddedSignup = embeddedSignup()) {
  return {
    /** Before the pop-up opens: a signed state whose nonce is the shop's one live attempt. */
    async start(orgId: string, userId: string): Promise<WhatsAppSignupStart> {
      await socialPlan.assert(orgId);
      if (!isSocialOpen(CHANNEL)) return { result: CONNECT_RESULT.UNAVAILABLE };
      const existing = await channelConnectionRepository.find(orgId, CHANNEL);
      const live = existing !== null && holdsNumber(existing.state);
      const nonce = newStateNonce();
      await channelConnectionRepository.openSignup(orgId, CHANNEL, nonce);
      const purpose = live ? CONNECT_PURPOSE.RECONNECT : CONNECT_PURPOSE.CONNECT;
      const state = signConnectState({ orgId, userId, channel: CHANNEL, purpose, nonce }, Date.now(), SIGNUP_TTL_MS);
      return { state, ...signup.settings() };
    },

    /** Read before anything is trusted; the route checks the signed-in member against it (R4). */
    readState(token: string): StateCheck {
      return verifyConnectState(token);
    },

    async complete(state: ConnectState, result: SignupResult, now = new Date()): Promise<ConnectResult> {
      // A state signed for another channel is never spent here.
      if (state.channel !== CHANNEL) return CONNECT_RESULT.EXPIRED;
      const { orgId, userId, purpose } = state;
      await socialPlan.assert(orgId);
      if (!isSocialOpen(CHANNEL)) return CONNECT_RESULT.UNAVAILABLE;
      // Spent before Meta is asked anything, so a replay, or a result from an older attempt, connects nothing (A3).
      if (!(await channelConnectionRepository.spendSignup(orgId, CHANNEL, state.nonce))) return CONNECT_RESULT.EXPIRED;

      let token: string;
      try {
        token = await signup.exchange(result.code);
        // The page's ids are believed only once Meta lists the number under the account for this token (R4).
        if (!(await signup.owns(token, result.businessId, result.phoneId))) return CONNECT_RESULT.EXPIRED;
      } catch (error) {
        return outcomeOf(error);
      }

      let outcome: ConnectResult = CONNECT_RESULT.CONNECTED;
      try {
        await prisma.$transaction(async (tx) => {
          await channelConnectionRepository.lockFor(tx, orgId, CHANNEL);
          const existing = await channelConnectionRepository.find(orgId, CHANNEL, tx);
          const live = existing !== null && holdsNumber(existing.state);
          // Switching numbers is disconnect, then connect (Q10).
          if (live && existing.externalPhoneId && existing.externalPhoneId !== result.phoneId) {
            outcome = CONNECT_RESULT.DIFFERENT_ACCOUNT;
            return;
          }
          const { id } = await channelConnectionRepository.claimWhatsApp(tx, {
            orgId,
            channel: CHANNEL,
            businessId: result.businessId,
            phoneId: result.phoneId,
            kind: result.kind,
            accessToken: encryptSecret(token),
            userId,
            now,
          });
          await recordAdminActionIn(tx, {
            adminId: userId,
            action: purpose === CONNECT_PURPOSE.RECONNECT ? "channel.reconnect" : "channel.connect",
            resource: "ChannelConnection",
            resourceId: id,
            metadata: { orgId, channel: CHANNEL, kind: result.kind },
          });
          await enqueue(tx, whatsappSetupSpec, { connectionId: id, orgId });
        });
      } catch (error) {
        // A number or account another shop holds live is refused by the partial unique indexes (Q10), races included.
        if (uniqueViolationFields(error) !== null) return CONNECT_RESULT.OTHER_SHOP;
        throw error;
      }
      return outcome;
    },
  };
}

export const whatsappConnect = whatsappConnectService();
