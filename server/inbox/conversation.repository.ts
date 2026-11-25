import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import type { ConversationKind, InboxMessageKind } from "./inbox.types";
import { CONVERSATION_KIND, SORT_RANK } from "./inbox.types";

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
  /** The platform account the thread is with, for retention (decisions Q20). */
  accountRef?: string | null;
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
        accountRef: key.accountRef ?? null,
      },
      update: {
        connectionId: key.connectionId,
        // A WhatsApp number is the person's on every account: the thread follows them to the shop's present one.
        ...(key.accountRef ? { accountRef: key.accountRef } : {}),
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
    if (arrival.inbound) {
      // A thread nothing waited on starts a new waiting spell, told about afresh (D5, decisions Q19).
      await tx.conversation.updateMany({
        where: { id, lastMessageAt: { lte: arrival.at }, unread: false, needsYou: false, waitingEmittedAt: { not: null } },
        data: { waitingEmittedAt: null },
      });
    }
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

  /**
   * Moves a DM thread to the person's new key, unless one already holds it (inbox-whatsapp D1, Q12): a
   * message under the new id handled before Meta's notice leaves two threads, both readable.
   */
  async rekey(tx: Tx, change: { orgId: string; platform: string; from: string; to: string; personKey: string }): Promise<void> {
    await tx.$executeRaw`
      UPDATE "Conversation"
      SET "threadKey" = ${change.to}, "personKey" = ${change.personKey},
          "changeSeq" = nextval('"Conversation_changeSeq_seq"'), "updatedAt" = timezone('UTC', now())
      WHERE "orgId" = ${change.orgId} AND "platform" = ${change.platform} AND "threadKey" = ${change.from}
        AND NOT EXISTS (
          SELECT 1 FROM "Conversation" c
          WHERE c."orgId" = ${change.orgId} AND c."platform" = ${change.platform} AND c."threadKey" = ${change.to}
        )`;
  },

  /** Something in the thread changed without a new message (a status, a reaction, an edit). */
  async touched(tx: Tx, ids: readonly string[]): Promise<void> {
    for (const id of new Set(ids)) await bump(tx, id);
  },
};

/** A thread the waiting sweep claimed: told about once per waiting spell (D5, decisions Q19). */
export interface WaitingClaim {
  id: string;
  orgId: string;
  platform: string;
}

/**
 * Waiting and Needs you (D5) and retention (D10): still the one writer of `Conversation`. Waiting is
 * Needs you or unread, with the newest message from the person at least four hours old.
 */
export const conversationCare = {
  /** Answers the thread's newest inbound time, or undefined when there is no such thread. */
  async markNeedsYou(tx: Tx, id: string, reason: string): Promise<{ lastInboundAt: Date | null } | undefined> {
    const rows = await tx.$queryRaw<Array<{ lastInboundAt: Date | null }>>`
      UPDATE "Conversation"
      SET "needsYou" = true, "needsYouReason" = ${reason}, "sortRank" = ${SORT_RANK.NEEDS_YOU},
          "waitingEmittedAt" = CASE WHEN "needsYou" OR "unread" THEN "waitingEmittedAt" ELSE NULL END,
          "changeSeq" = nextval('"Conversation_changeSeq_seq"'), "updatedAt" = timezone('UTC', now())
      WHERE "id" = ${id}
      RETURNING "lastInboundAt"`;
    return rows[0];
  },

  /** Claims up to `take` threads waiting since `cutoff` and not yet told about, oldest first; a racing sweep skips them. */
  async claimWaiting(tx: Tx, cutoff: Date, now: Date, take: number): Promise<WaitingClaim[]> {
    return await tx.$queryRaw<WaitingClaim[]>`
      UPDATE "Conversation" SET "waitingEmittedAt" = ${now}
      WHERE "id" IN (
        SELECT "id" FROM "Conversation"
        WHERE "waitingEmittedAt" IS NULL AND ("needsYou" OR "unread") AND "lastInboundAt" <= ${cutoff}
        ORDER BY "lastInboundAt"
        LIMIT ${take}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "orgId", "platform"`;
  },

  /** The newest-inbound time of the thread that will start waiting soonest, or null when none will. */
  async nextWaiting(): Promise<Date | null> {
    const rows = await prisma.$queryRaw<Array<{ at: Date | null }>>`
      SELECT MIN("lastInboundAt") AS "at" FROM "Conversation"
      WHERE "waitingEmittedAt" IS NULL AND ("needsYou" OR "unread") AND "lastInboundAt" IS NOT NULL`;
    return rows[0]?.at ?? null;
  },

  async waitingState(ids: readonly string[]): Promise<Array<{ id: string; needsYou: boolean; unread: boolean }>> {
    if (ids.length === 0) return [];
    return await prisma.conversation.findMany({ where: { id: { in: [...ids] } }, select: { id: true, needsYou: true, unread: true } });
  },

  async ofShop(orgId: string, id: string): Promise<{ id: string; orgId: string } | null> {
    return await prisma.conversation.findFirst({ where: { id, orgId }, select: { id: true, orgId: true } });
  },

  /** Names for the privacy sheet; a deleted thread is simply absent. */
  async names(orgId: string, ids: readonly string[]): Promise<Array<{ id: string; personName: string | null; personHandle: string | null; personPhone: string | null }>> {
    if (ids.length === 0) return [];
    return await prisma.conversation.findMany({
      where: { orgId, id: { in: [...ids] } },
      select: { id: true, personName: true, personHandle: true, personPhone: true },
    });
  },

  /**
   * Up to `take` threads retention may delete for a settled connection (D10): every one when it is
   * disconnected, else those with an account it is no longer on. A thread whose account is unknown is kept.
   */
  async retired(connectionId: string, liveAccountId: string | null, disconnected: boolean, take: number): Promise<string[]> {
    const where: Prisma.ConversationWhereInput | null = disconnected
      ? { connectionId }
      : liveAccountId
        ? { connectionId, accountRef: { not: null }, NOT: { accountRef: liveAccountId } }
        : null;
    if (!where) return [];
    const rows = await prisma.conversation.findMany({
      where,
      select: { id: true },
      take,
    });
    return rows.map((row) => row.id);
  },

  /** A person's threads in every shop (meta-foundation D7): what they started, by their platform id. */
  async ofPerson(platform: string, personKey: string, take: number): Promise<string[]> {
    const rows = await prisma.conversation.findMany({ where: { platform, personKey }, select: { id: true }, take });
    return rows.map((row) => row.id);
  },

  /** Deletes the threads, their messages and shares with them (cascade); the open log stays (SealAccess). */
  async remove(ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { count } = await prisma.conversation.deleteMany({ where: { id: { in: [...ids] } } });
    return count;
  },
};

/** What a member's reply needs of its thread (inbox-core D6). */
export interface ReplyTarget {
  id: string;
  connectionId: string;
  platform: string;
  kind: string;
  personKey: string;
  threadKey: string;
  postRef: string | null;
  lastInboundAt: Date | null;
}

export const conversationReplies = {
  async target(orgId: string, id: string): Promise<ReplyTarget | null> {
    return await prisma.conversation.findFirst({
      where: { id, orgId },
      select: { id: true, connectionId: true, platform: true, kind: true, personKey: true, threadKey: true, postRef: true, lastInboundAt: true },
    });
  },

  /** A member answered (D6): it no longer needs the shop, and automatic replies pause in it (enquiry-autoreplies R7). */
  async memberReplied(tx: Tx, orgId: string, id: string, botPausedUntil: Date): Promise<void> {
    await tx.$executeRaw`
      UPDATE "Conversation"
      SET "needsYou" = false, "needsYouReason" = NULL, "sortRank" = ${SORT_RANK.OTHER},
          "botPausedUntil" = GREATEST(COALESCE("botPausedUntil", ${botPausedUntil}), ${botPausedUntil}),
          "changeSeq" = nextval('"Conversation_changeSeq_seq"'), "updatedAt" = timezone('UTC', now())
      WHERE "id" = ${id} AND "orgId" = ${orgId}`;
  },
};
