import { randomUUID } from "node:crypto";
import { channelConnectionRepository } from "./channel-connection.repository";
import { CONNECTION_STATE } from "./channel-connection.types";
import { connectionLaneRepository, LANE } from "./connection-lane.repository";
import type { ConversationSource, OutgoingMessage, ReplyWindow, SendOutcome, WindowInput } from "./conversation-source.types";
import { MetaError } from "./providers/meta/errors";
import { SOCIAL_ERROR } from "./social/types";

/**
 * The inbox's way to a platform (inbox-core D7). Each platform's source registers here; a send runs
 * under the account's `messages` lease (A-D9), so one account's sends never overlap.
 */

/** Longer than the Graph client's ten-second timeout, so a lease never ends under a call in flight. */
const LEASE_SECONDS = 30;

const sources = new Map<string, ConversationSource>();

export function registerConversationSource(source: ConversationSource): void {
  if (sources.has(source.platform)) throw new Error(`A conversation source for "${source.platform}" is registered twice`);
  sources.set(source.platform, source);
}

/** Test seam: forget every source. */
export function resetConversationSources(): void {
  sources.clear();
}

export const conversationSources = {
  /** Whether a platform's inbox is built: a thread on one that is not cannot be answered yet. */
  has(platform: string): boolean {
    return sources.has(platform);
  },

  /** The reply window now (D3); null when the platform has no source. */
  window(platform: string, input: WindowInput): ReplyWindow | null {
    return sources.get(platform)?.window(input) ?? null;
  },

  /** One send, for the shop that holds the connection. Never throws a platform's error: it answers an outcome. */
  async send(orgId: string, platform: string, message: OutgoingMessage): Promise<SendOutcome> {
    const source = sources.get(platform);
    const connection = await channelConnectionRepository.byId(message.conversation.connectionId);
    // A missing source or a connection gone from the shop is a send that never left.
    if (!source) return { outcome: "not-sent", error: SOCIAL_ERROR.REFUSED, retryAfterSeconds: null };
    if (!connection || connection.orgId !== orgId || connection.state !== CONNECTION_STATE.CONNECTED) {
      return { outcome: "not-sent", error: SOCIAL_ERROR.AUTH, retryAfterSeconds: null };
    }

    const holder = randomUUID();
    if (!(await connectionLaneRepository.claim(connection.id, LANE.MESSAGES, holder, LEASE_SECONDS))) return { outcome: "busy" };
    try {
      const { platformMessageId } = await source.send(message);
      return { outcome: "sent", platformMessageId };
    } catch (error) {
      if (!(error instanceof MetaError)) {
        // Not a platform's answer: whether the call left is unknown, and a duplicate is worse than a gap (ADR-0086).
        console.error(JSON.stringify({ scope: "channels.conversation-send", connectionId: connection.id, error: (error as Error)?.name ?? "Error" }));
        return { outcome: "uncertain" };
      }
      if (error.code === SOCIAL_ERROR.UNCERTAIN) return { outcome: "uncertain" };
      return { outcome: "not-sent", error: error.code, retryAfterSeconds: error.retryAfterSeconds };
    } finally {
      // A lease left to expire costs 30 s; a thrown release would turn a send that went into a failure.
      await connectionLaneRepository.release(connection.id, LANE.MESSAGES, holder).catch(() =>
        console.error(JSON.stringify({ scope: "channels.conversation-send", connectionId: connection.id, error: "lease-release" })),
      );
    }
  },
};
