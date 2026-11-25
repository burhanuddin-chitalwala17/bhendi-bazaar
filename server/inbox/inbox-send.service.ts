import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { conversationSources } from "@server/channels/conversation-source.service";
import { FREE_REPLY_WINDOWS, SOCIAL_ERROR, type ConversationRef, type ReplyWindow } from "@server/channels/conversation-source.types";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { enqueue } from "@server/shared/jobs";
import { prisma } from "@server/shared/prisma";
import { seal } from "@server/shared/seal/seal";
import type { ReplyInput } from "@/lib/validation/schemas/inbox-reply.schema";
import { conversationReplies, conversationRepository, type ReplyTarget } from "./conversation.repository";
import { inboxSendSpec } from "./inbox-send.job";
import {
  AUTO_RETRY_SECONDS,
  BOT_PAUSE_HOURS,
  BUSY_RETRY_SECONDS,
  HOLD_SECONDS,
  INBOX_SEND_COPY,
  MAX_AUTO_ATTEMPTS,
  type SentReplyDTO,
  type UndoneReplyDTO,
} from "./inbox-send.types";
import {
  CONVERSATION_KIND,
  INBOX_MESSAGE_KIND,
  MESSAGE_AUTHOR,
  MESSAGE_DIRECTION,
  MESSAGE_STATE,
  PREVIEW_CHARS,
  type InboxMessageKind,
  type MessageState,
} from "./inbox.types";
import { messageRepository, outboxRepository, type SendRow } from "./message.repository";
import { previewOf } from "./message-rows";

/**
 * Sending from the inbox (social-selling inbox-core D6; R5, R9; Q9, Q16): a member's reply is a held
 * row and its job, written together; the job releases it at the hold's end, claims it, and calls the
 * platform through the `ConversationSource` port. A duplicate message is worse than a missing one
 * (ADR-0086): only a platform's "not sent" is retried, once.
 */

/** The platform said nothing went: the one automatic retry may follow (Q9). */
const NOT_SENT_RETRYABLE = new Set<string>([SOCIAL_ERROR.RATE_LIMITED, SOCIAL_ERROR.UNAVAILABLE]);

const later = (seconds: number) => new Date(Date.now() + seconds * 1000);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The queue wakes a worker at once only for a job due now; a delayed one waits for its 5-minute backstop
 * poll. So a send's job is queued due now and waits out the row's `sendAfter` itself, up to this long.
 */
const MAX_INLINE_WAIT_MS = 30_000;
/** The release is on the database's clock: a worker a little ahead looks again this often, this many times. */
const RELEASE_LOOKS = 5;
const RELEASE_LOOK_MS = 500;

const kindOf = (kind: string): ConversationRef["kind"] => (kind === CONVERSATION_KIND.COMMENT ? CONVERSATION_KIND.COMMENT : CONVERSATION_KIND.DM);

const refOf = (target: Pick<ReplyTarget, "connectionId" | "kind" | "personKey" | "threadKey" | "postRef">): ConversationRef => ({
  connectionId: target.connectionId,
  kind: kindOf(target.kind),
  personKey: target.personKey,
  threadKey: target.threadKey,
  postRef: target.postRef,
});

const windowOf = (target: Pick<ReplyTarget, "platform" | "kind" | "lastInboundAt">): ReplyWindow | null =>
  conversationSources.window(target.platform, { kind: kindOf(target.kind), lastInboundAt: target.lastInboundAt, now: new Date() });

const dto = (row: Pick<SendRow, "id" | "state" | "sendAfter">): SentReplyDTO => ({
  id: row.id,
  state: row.state as MessageState,
  sendAfter: row.sendAfter?.toISOString() ?? null,
});

/** A free reply goes only where the platform allows one now (D3, Q7); the server checks, whatever the box showed. */
function assertCanReply(target: ReplyTarget): void {
  if (!conversationSources.has(target.platform)) throw new ConflictError(INBOX_SEND_COPY.platformNotReady);
  const window = windowOf(target);
  if (!window || !FREE_REPLY_WINDOWS.includes(window.state)) throw new ConflictError(INBOX_SEND_COPY.windowShut);
}

async function queueRow(input: {
  orgId: string;
  target: ReplyTarget;
  dedupeKey: string;
  author: typeof MESSAGE_AUTHOR.MEMBER | typeof MESSAGE_AUTHOR.AUTOMATIC;
  memberId: string | null;
  text: string | null;
  mediaId: string | null;
  hold: boolean;
}): Promise<SentReplyDTO> {
  const { orgId, target } = input;
  const existing = await outboxRepository.findByDedupe(orgId, input.dedupeKey);
  if (existing) {
    if (existing.conversationId !== target.id) throw new NotFoundError(INBOX_SEND_COPY.messageNotFound);
    return dto(existing);
  }
  const id = randomUUID();
  // Sealed before the transaction opens, as every sealed write here is.
  const bodySealed = input.text ? await seal.seal({ orgId, table: "Message", rowId: id }, input.text) : null;
  const now = new Date();
  const sendAfter = input.hold ? later(HOLD_SECONDS) : null;
  const state = input.hold ? MESSAGE_STATE.HELD : MESSAGE_STATE.QUEUED;
  const written = await prisma.$transaction(async (tx) => {
    const ids = await messageRepository.insert(tx, [
      {
        id,
        conversationId: target.id,
        orgId,
        direction: MESSAGE_DIRECTION.OUT,
        author: input.author,
        memberId: input.memberId,
        kind: input.mediaId ? INBOX_MESSAGE_KIND.IMAGE : INBOX_MESSAGE_KIND.TEXT,
        label: null,
        bodySealed,
        attachmentRef: input.mediaId,
        refersTo: null,
        platformMessageId: null,
        dedupeKey: input.dedupeKey,
        state,
        sentAt: now,
        sendAfter,
      },
    ]);
    // A second tap racing the first: the first's row and job stand.
    if (ids.size === 0) return false;
    if (input.author === MESSAGE_AUTHOR.MEMBER) {
      await conversationReplies.memberReplied(tx, orgId, target.id, later(BOT_PAUSE_HOURS * 3600));
    } else {
      await conversationRepository.touched(tx, [target.id]);
    }
    await enqueue(tx, inboxSendSpec, { messageId: id, orgId });
    return true;
  });
  if (!written) {
    const first = await outboxRepository.findByDedupe(orgId, input.dedupeKey);
    if (!first || first.conversationId !== target.id) throw new NotFoundError(INBOX_SEND_COPY.messageNotFound);
    return dto(first);
  }
  return { id, state, sendAfter: sendAfter?.toISOString() ?? null };
}

/** One step of the row's life with its conversation bumped, and its next job (due now) when it has one. */
async function step(
  orgId: string,
  messageId: string,
  write: (tx: Prisma.TransactionClient) => Promise<{ conversationId: string } | null>,
  next = false,
): Promise<boolean> {
  return await prisma.$transaction(async (tx) => {
    const moved = await write(tx);
    if (!moved) return false;
    await conversationRepository.touched(tx, [moved.conversationId]);
    if (next) await enqueue(tx, inboxSendSpec, { messageId, orgId });
    return true;
  });
}

const requeueAt = (orgId: string, messageId: string, at: Date) =>
  prisma.$transaction((tx) => enqueue(tx, inboxSendSpec, { messageId, orgId }, { startAfter: at }));

/** Releases a held row at its hold's end. False when it is gone (Undo won) or the wait was handed back to the queue. */
async function release(orgId: string, messageId: string): Promise<boolean> {
  for (let look = 0; look < RELEASE_LOOKS; look++) {
    if (await step(orgId, messageId, (tx) => outboxRepository.releaseHeld(tx, orgId, messageId))) return true;
    const still = await outboxRepository.find(orgId, messageId);
    if (still?.state !== MESSAGE_STATE.HELD) return false;
    await sleep(RELEASE_LOOK_MS);
  }
  const still = await outboxRepository.find(orgId, messageId);
  if (still?.state === MESSAGE_STATE.HELD) await requeueAt(orgId, messageId, later(1));
  return false;
}

export const inboxSendService = {
  /** A member's reply (R5): held seven seconds with Undo (Q16); a double tap with the same client id is one reply. */
  async send(orgId: string, memberId: string, conversationId: string, input: ReplyInput): Promise<SentReplyDTO> {
    const target = await conversationReplies.target(orgId, conversationId);
    if (!target) throw new NotFoundError(INBOX_SEND_COPY.conversationNotFound);
    assertCanReply(target);
    if (input.mediaId && !(await mediaAssetService.findReadyImage(orgId, { assetId: input.mediaId }))) {
      throw new DomainError(INBOX_SEND_COPY.mediaNotInLibrary, { field: "mediaId" });
    }
    return await queueRow({
      orgId,
      target,
      dedupeKey: `${orgId}:member:${input.clientId}`,
      author: MESSAGE_AUTHOR.MEMBER,
      memberId,
      text: input.text || null,
      mediaId: input.mediaId ?? null,
      hold: true,
    });
  },

  /**
   * An automatic reply (automations): no hold, no pause, Needs you untouched. `key` is the caller's
   * own idempotency key, so a re-run of its job sends once.
   */
  async sendAutomatic(input: { orgId: string; conversationId: string; key: string; text: string }): Promise<SentReplyDTO> {
    const target = await conversationReplies.target(input.orgId, input.conversationId);
    if (!target) throw new NotFoundError(INBOX_SEND_COPY.conversationNotFound);
    assertCanReply(target);
    return await queueRow({
      orgId: input.orgId,
      target,
      dedupeKey: `${input.orgId}:automatic:${input.key}`,
      author: MESSAGE_AUTHOR.AUTOMATIC,
      memberId: null,
      text: input.text,
      mediaId: null,
      hold: false,
    });
  },

  /** Undo (Q16): a held reply is cancelled and its text and picture go back in the box; once released, it is too late. */
  async undo(orgId: string, messageId: string): Promise<UndoneReplyDTO> {
    const row = await outboxRepository.find(orgId, messageId);
    if (!row || row.author !== MESSAGE_AUTHOR.MEMBER) throw new NotFoundError(INBOX_SEND_COPY.messageNotFound);
    if (!(await step(orgId, messageId, (tx) => outboxRepository.cancelHeld(tx, orgId, messageId)))) {
      throw new ConflictError(INBOX_SEND_COPY.alreadySent);
    }
    const text = row.bodySealed ? await seal.open({ orgId, table: "Message", rowId: row.id }, row.bodySealed) : "";
    return { text, mediaId: row.attachmentRef };
  },

  /** Try again (R9): the same failed row, queued now, with its automatic retry restored. */
  async retry(orgId: string, messageId: string): Promise<SentReplyDTO> {
    const row = await outboxRepository.find(orgId, messageId);
    if (!row || row.author !== MESSAGE_AUTHOR.MEMBER) throw new NotFoundError(INBOX_SEND_COPY.messageNotFound);
    if (!(await step(orgId, messageId, (tx) => outboxRepository.requeueFailed(tx, orgId, messageId), true))) {
      throw new ConflictError(INBOX_SEND_COPY.notFailed);
    }
    return { id: row.id, state: MESSAGE_STATE.QUEUED, sendAfter: null };
  },

  /** The `inbox.send` job: the row's next step, safe to run again (jobs run at least once). */
  async deliver(orgId: string, messageId: string): Promise<void> {
    const row = await outboxRepository.find(orgId, messageId);
    if (!row) return;

    // A hold, a busy lane or the automatic retry's pause: waited out here, or handed back to the queue when long.
    const waiting = row.state === MESSAGE_STATE.HELD || row.state === MESSAGE_STATE.QUEUED;
    const wait = waiting && row.sendAfter ? row.sendAfter.getTime() - Date.now() : 0;
    if (wait > MAX_INLINE_WAIT_MS) return void (await requeueAt(orgId, messageId, row.sendAfter!));
    if (wait > 0) await sleep(wait);

    if (row.state === MESSAGE_STATE.HELD) {
      if (!(await release(orgId, messageId))) return;
    } else if (row.state === MESSAGE_STATE.CLAIMED) {
      // A try that died between the claim and the answer may have reached the buyer (ADR-0086).
      await step(orgId, messageId, (tx) => outboxRepository.markUncertain(tx, orgId, messageId));
      return;
    } else if (row.state !== MESSAGE_STATE.QUEUED) {
      return;
    }

    const failBeforeCall = (code: string) =>
      step(orgId, messageId, (tx) => outboxRepository.markFailed(tx, orgId, messageId, [MESSAGE_STATE.QUEUED], code));
    const window = windowOf(row.conversation);
    if (window && !FREE_REPLY_WINDOWS.includes(window.state)) return void (await failBeforeCall(SOCIAL_ERROR.WINDOW_CLOSED));
    let imageUrl: string | null = null;
    if (row.kind === INBOX_MESSAGE_KIND.IMAGE && row.attachmentRef) {
      const asset = await mediaAssetService.findReadyImage(orgId, { assetId: row.attachmentRef });
      // Retired from the library during the hold.
      if (!asset) return void (await failBeforeCall(SOCIAL_ERROR.REFUSED));
      imageUrl = asset.ref;
    }

    // Opened before the claim: a body that will not open must not leave a claimed row that looks half-sent.
    const text = row.bodySealed ? await seal.open({ orgId, table: "Message", rowId: row.id }, row.bodySealed) : null;
    const claimed = await outboxRepository.claim(orgId, messageId);
    if (!claimed) return;
    const result = await conversationSources.send(orgId, row.conversation.platform, {
      messageId,
      conversation: refOf(row.conversation),
      text,
      imageUrl,
      window: window?.state ?? FREE_REPLY_WINDOWS[0],
    });

    switch (result.outcome) {
      case "sent": {
        const at = new Date();
        const preview = previewOf(text, PREVIEW_CHARS);
        const previewSealed = preview ? await seal.seal({ orgId, table: "Conversation", rowId: row.conversationId }, preview) : null;
        await prisma.$transaction(async (tx) => {
          await outboxRepository.markSent(tx, orgId, messageId, result.platformMessageId, at);
          await conversationRepository.arrived(tx, row.conversationId, { at, inbound: false, kind: row.kind as InboxMessageKind, previewSealed });
        });
        return;
      }
      case "busy":
        await step(orgId, messageId, (tx) => outboxRepository.unclaimUntried(tx, orgId, messageId, later(BUSY_RETRY_SECONDS)), true);
        return;
      case "not-sent":
        if (NOT_SENT_RETRYABLE.has(result.error) && claimed.sendAttempts < MAX_AUTO_ATTEMPTS) {
          const after = later(result.retryAfterSeconds ?? AUTO_RETRY_SECONDS);
          await step(orgId, messageId, (tx) => outboxRepository.requeueNotSent(tx, orgId, messageId, result.error, after), true);
          return;
        }
        await step(orgId, messageId, (tx) => outboxRepository.markFailed(tx, orgId, messageId, [MESSAGE_STATE.CLAIMED], result.error));
        return;
      case "uncertain":
        await step(orgId, messageId, (tx) => outboxRepository.markUncertain(tx, orgId, messageId));
        return;
    }
  },
};
