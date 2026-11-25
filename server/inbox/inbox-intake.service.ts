import { randomUUID } from "node:crypto";
import { socialOwners, type SocialOwner } from "@server/channels/social-owners.service";
import { prisma } from "@server/shared/prisma";
import { seal } from "@server/shared/seal/seal";
import { MESSAGE_STATUS, type FactOf } from "@server/shared/social-events/facts";
import { PermanentFactError } from "@server/shared/social-events/sinks";
import { conversationRepository, type ConversationKey } from "./conversation.repository";
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
import { messageRepository, type NewMessage } from "./message.repository";
import { messageRows, previewOf, STRUCTURED_KINDS } from "./message-rows";

/**
 * Facts become conversations and messages (social-selling inbox-core D2). Each fact lands in one
 * transaction, idempotent on its dedupe key, so a drain that hands it again writes nothing (R12).
 * Bodies and previews are sealed under the shop's key before they are written (A-D12).
 */

type Person = Pick<FactOf<"inbound-message">, "personKey" | "personName" | "personHandle" | "personPhone">;

interface Draft {
  part: string;
  kind: InboxMessageKind;
  label: string | null;
  text: string | null;
  attachmentRef: string | null;
}

interface Landing {
  key: Omit<ConversationKey, "orgId">;
  inbound: boolean;
  /** A reaction or an edit changes the thread without becoming its newest message. */
  isArrival: boolean;
  dedupeKey: string;
  platformMessageId: string | null;
  refersTo: string | null;
  state: MessageState | null;
  drafts: Draft[];
}

const STATUS: Record<FactOf<"message-status">["status"], MessageState> = {
  [MESSAGE_STATUS.SENT]: MESSAGE_STATE.SENT,
  [MESSAGE_STATUS.DELIVERED]: MESSAGE_STATE.DELIVERED,
  [MESSAGE_STATUS.READ]: MESSAGE_STATE.READ,
  [MESSAGE_STATUS.FAILED]: MESSAGE_STATE.FAILED,
};

const dmKey = (fact: { connectionId: string; platform: string; occurredAt: Date } & Person): Omit<ConversationKey, "orgId"> => ({
  connectionId: fact.connectionId,
  platform: fact.platform,
  kind: CONVERSATION_KIND.DM,
  threadKey: `dm:${fact.personKey}`,
  personKey: fact.personKey,
  personName: fact.personName,
  personHandle: fact.personHandle,
  personPhone: fact.personPhone,
  postRef: null,
  at: fact.occurredAt,
});

async function ownersOf(facts: ReadonlyArray<{ connectionId: string }>): Promise<(connectionId: string) => SocialOwner> {
  const owners = await socialOwners.of(facts.map((fact) => fact.connectionId));
  return (connectionId) => {
    const owner = owners.get(connectionId);
    if (!owner) throw new PermanentFactError("A fact names a connection that does not exist");
    return owner;
  };
}

async function land(orgId: string, landing: Landing): Promise<void> {
  // Sealed before the transaction opens, so a shop's first key is never made while it is held.
  const sealed = await Promise.all(
    landing.drafts.map(async (draft) => {
      const id = randomUUID();
      return { id, draft, bodySealed: draft.text ? await seal.seal({ orgId, table: "Message", rowId: id }, draft.text) : null };
    }),
  );
  await prisma.$transaction(async (tx) => {
    const conversationId = await conversationRepository.ensure(tx, { ...landing.key, orgId });
    const rows: NewMessage[] = sealed.map(({ id, draft, bodySealed }) => ({
      id,
      conversationId,
      orgId,
      direction: landing.inbound ? MESSAGE_DIRECTION.IN : MESSAGE_DIRECTION.OUT,
      author: landing.inbound ? MESSAGE_AUTHOR.PERSON : MESSAGE_AUTHOR.APP,
      kind: draft.kind,
      label: draft.label,
      bodySealed,
      attachmentRef: draft.attachmentRef,
      refersTo: landing.refersTo,
      platformMessageId: landing.platformMessageId,
      dedupeKey: `${landing.dedupeKey}${draft.part}`,
      state: landing.state,
      sentAt: landing.key.at,
    }));
    const written = await messageRepository.insert(tx, rows);
    if (written.size === 0) return;
    if (!landing.isArrival) return conversationRepository.touched(tx, [conversationId]);
    const last = rows.findLastIndex((row) => written.has(row.id));
    const newest = rows[last];
    // A cart's or a location's body is a structure; the list names it by its kind instead.
    const text = STRUCTURED_KINDS.has(newest.kind) ? null : previewOf(landing.drafts[last].text, PREVIEW_CHARS);
    await conversationRepository.arrived(tx, conversationId, {
      at: landing.key.at,
      inbound: landing.inbound,
      kind: newest.kind,
      previewSealed: text ? await seal.seal({ orgId, table: "Conversation", rowId: conversationId }, text) : null,
    });
  });
}

const base = (orgId: string, fact: { platform: string }) => `${orgId}:${fact.platform}`;

export const inboxIntake = {
  /** A message the person sent, or one the shop sent from the platform's own app (`inbound` false). */
  async messages(facts: ReadonlyArray<FactOf<"inbound-message"> | FactOf<"outbound-echo">>, inbound: boolean): Promise<void> {
    const owner = await ownersOf(facts);
    for (const fact of facts) {
      const { orgId } = owner(fact.connectionId);
      // Instagram echoes what we sent through the API too; that row is already ours.
      if (!inbound && (await messageRepository.hasPlatformId(orgId, fact.messageId))) continue;
      await land(orgId, {
        key: dmKey(fact),
        inbound,
        isArrival: true,
        dedupeKey: `${base(orgId, fact)}:${fact.messageId}`,
        platformMessageId: fact.messageId,
        refersTo: null,
        state: inbound ? null : MESSAGE_STATE.SENT,
        drafts: messageRows(fact),
      });
    }
  },

  async statuses(facts: ReadonlyArray<FactOf<"message-status">>): Promise<void> {
    const owner = await ownersOf(facts);
    for (const fact of facts) {
      const { orgId } = owner(fact.connectionId);
      await prisma.$transaction(async (tx) => {
        const moved = await messageRepository.applyStatus(tx, {
          orgId,
          platformMessageId: fact.messageId,
          callbackRef: fact.callbackRef,
          state: STATUS[fact.status],
          errorCode: fact.errorCode === null ? null : String(fact.errorCode),
        });
        await conversationRepository.touched(tx, moved);
      });
    }
  },

  /** A reaction, or its removal (an empty body), on the message it names. */
  async reactions(facts: ReadonlyArray<FactOf<"reaction">>): Promise<void> {
    const owner = await ownersOf(facts);
    for (const fact of facts) {
      const { orgId, selfIds } = owner(fact.connectionId);
      // The shop's own reaction or edit in the platform's app names the shop as the person: no thread of its own.
      if (selfIds.includes(fact.personKey)) continue;
      await land(orgId, {
        key: dmKey(fact),
        inbound: true,
        isArrival: false,
        dedupeKey: `${base(orgId, fact)}:reaction:${fact.key}`,
        platformMessageId: null,
        refersTo: fact.messageId || null,
        state: null,
        drafts: [{ part: "", kind: INBOX_MESSAGE_KIND.REACTION, label: null, text: fact.emoji, attachmentRef: null }],
      });
    }
  },

  /** The person changed a message's text: kept as its own row, so nothing the shop already read is rewritten. */
  async edits(facts: ReadonlyArray<FactOf<"message-edit">>): Promise<void> {
    const owner = await ownersOf(facts);
    for (const fact of facts) {
      const { orgId, selfIds } = owner(fact.connectionId);
      // The shop's own reaction or edit in the platform's app names the shop as the person: no thread of its own.
      if (selfIds.includes(fact.personKey)) continue;
      await land(orgId, {
        key: dmKey(fact),
        inbound: true,
        isArrival: false,
        dedupeKey: `${base(orgId, fact)}:edit:${fact.key}`,
        platformMessageId: null,
        refersTo: fact.messageId || null,
        state: null,
        drafts: [{ part: "", kind: INBOX_MESSAGE_KIND.EDIT, label: null, text: fact.text, attachmentRef: null }],
      });
    }
  },

  /** A comment under a post: its thread is the top comment and its replies (Q2). */
  async comments(facts: ReadonlyArray<FactOf<"comment">>): Promise<void> {
    const owner = await ownersOf(facts);
    for (const fact of facts) {
      const { orgId, selfIds } = owner(fact.connectionId);
      const ours = selfIds.includes(fact.personKey);
      // The shop's own top-level comment is not a conversation with anyone.
      if (ours && !fact.parentId) continue;
      await land(orgId, {
        key: {
          connectionId: fact.connectionId,
          platform: fact.platform,
          kind: CONVERSATION_KIND.COMMENT,
          threadKey: `comment:${fact.parentId ?? fact.commentId}`,
          personKey: fact.personKey,
          personName: fact.personName,
          personHandle: fact.personHandle,
          personPhone: null,
          postRef: fact.mediaId,
          at: fact.occurredAt,
        },
        inbound: !ours,
        isArrival: true,
        dedupeKey: `${base(orgId, fact)}:comment:${fact.commentId}`,
        platformMessageId: fact.commentId,
        refersTo: null,
        state: ours ? MESSAGE_STATE.SENT : null,
        drafts: [{ part: "", kind: INBOX_MESSAGE_KIND.TEXT, label: null, text: fact.text, attachmentRef: null }],
      });
    }
  },

  /**
   * Meta gave the person a new id (inbox-whatsapp D1): their thread is re-keyed in place, so what follows
   * lands in it. A thread already under the new id is left as it is; both stay readable.
   */
  async rekeys(facts: ReadonlyArray<FactOf<"person-rekeyed">>): Promise<void> {
    const owner = await ownersOf(facts);
    for (const fact of facts) {
      const { orgId } = owner(fact.connectionId);
      await prisma.$transaction((tx) =>
        conversationRepository.rekey(tx, { orgId, platform: fact.platform, from: `dm:${fact.previousKey}`, to: `dm:${fact.personKey}`, personKey: fact.personKey }),
      );
    }
  },

  /** A cart sent from the catalogue: retailer ids and quantities only, sealed with the note (ADR-0002). */
  async carts(facts: ReadonlyArray<FactOf<"cart-order">>): Promise<void> {
    const owner = await ownersOf(facts);
    for (const fact of facts) {
      const { orgId } = owner(fact.connectionId);
      const cart = JSON.stringify({ catalogueId: fact.catalogueId, note: fact.note, items: fact.items });
      await land(orgId, {
        key: dmKey(fact),
        inbound: true,
        isArrival: true,
        dedupeKey: `${base(orgId, fact)}:${fact.messageId}`,
        platformMessageId: fact.messageId,
        refersTo: null,
        state: null,
        drafts: [{ part: "", kind: INBOX_MESSAGE_KIND.CART, label: null, text: cart, attachmentRef: null }],
      });
    }
  },
};
