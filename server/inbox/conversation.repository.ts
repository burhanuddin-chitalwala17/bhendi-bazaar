import type { Prisma } from "@prisma/client";
import type { ConversationKind, InboxMessageKind } from "./inbox.types";
import { CONVERSATION_KIND } from "./inbox.types";

/**
 * The one writer of `Conversation` (Invariant 5). Every write takes a fresh `changeSeq`, the change
 * feed's cursor (A-D14); a thread's order and preview follow platform time, never arrival (D2).
 */

type Tx = Prisma.TransactionClient;

export interface ConversationKey {
  orgId: string;
  connectionId: string;
  platform: string;
  kind: ConversationKind;
  threadKey: string;
  personKey: string;
  personName: string | null;
  personHandle: string | null;
  personPhone: string | null;
  postRef: string | null;
  at: Date;
}

export interface Arrival {
  at: Date;
  inbound: boolean;
  kind: InboxMessageKind;
  /** Sealed for this conversation's row, or null when the list names the row by its kind. */
  previewSealed: string | null;
}

const bump = (tx: Tx, id: string) =>
  tx.$executeRaw`UPDATE "Conversation" SET "changeSeq" = nextval('"Conversation_changeSeq_seq"'), "updatedAt" = timezone('UTC', now()) WHERE "id" = ${id}`;

export const conversationRepository = {
  /**
   * The thread a fact belongs to, made on first sight (Q2). A DM takes the person's newest name, handle
   * and number; a comment thread keeps the person who started it, whoever replies.
   */
  async ensure(tx: Tx, key: ConversationKey): Promise<string> {
    const named = key.kind === CONVERSATION_KIND.DM;
    const { id } = await tx.conversation.upsert({
      where: { orgId_platform_threadKey: { orgId: key.orgId, platform: key.platform, threadKey: key.threadKey } },
      create: {
        orgId: key.orgId,
        connectionId: key.connectionId,
        platform: key.platform,
        kind: key.kind,
        threadKey: key.threadKey,
        personKey: key.personKey,
        personName: key.personName,
        personHandle: key.personHandle,
        personPhone: key.personPhone,
        postRef: key.postRef,
        lastMessageAt: key.at,
      },
      update: {
        connectionId: key.connectionId,
        ...(named && key.personName ? { personName: key.personName } : {}),
        ...(named && key.personHandle ? { personHandle: key.personHandle } : {}),
        ...(named && key.personPhone ? { personPhone: key.personPhone } : {}),
      },
      select: { id: true },
    });
    return id;
  },

  /**
   * A new message in the thread. Only one at least as new as the newest moves the preview and the
   * unread flag (Q3: unread while the newest is the person's), so a late delivery reads in place.
   */
  async arrived(tx: Tx, id: string, arrival: Arrival): Promise<void> {
    await tx.conversation.updateMany({
      where: { id, lastMessageAt: { lte: arrival.at } },
      data: { lastMessageAt: arrival.at, lastPreviewSealed: arrival.previewSealed, lastMessageKind: arrival.kind, unread: arrival.inbound },
    });
    if (arrival.inbound) {
      await tx.conversation.updateMany({
        where: { id, OR: [{ lastInboundAt: null }, { lastInboundAt: { lt: arrival.at } }] },
        data: { lastInboundAt: arrival.at },
      });
    }
    await bump(tx, id);
  },

  /** Something in the thread changed without a new message (a status, a reaction, an edit). */
  async touched(tx: Tx, ids: readonly string[]): Promise<void> {
    for (const id of new Set(ids)) await bump(tx, id);
  },
};
