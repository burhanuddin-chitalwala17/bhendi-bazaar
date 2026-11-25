import { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { MESSAGE_STATE, statesBelow, type InboxMessageKind, type MessageAuthor, type MessageDirection, type MessageState } from "./inbox.types";

/** The one writer of `Message` (Invariant 5): stored once by its dedupe key (R12), its state only ever raised (D2). */

type Tx = Prisma.TransactionClient;

export interface NewMessage {
  /** Made by the caller, because the body is sealed to the row before it is written. */
  id: string;
  conversationId: string;
  orgId: string;
  direction: MessageDirection;
  author: MessageAuthor;
  kind: InboxMessageKind;
  label: string | null;
  bodySealed: string | null;
  attachmentRef: string | null;
  refersTo: string | null;
  platformMessageId: string | null;
  dedupeKey: string;
  state: MessageState | null;
  sentAt: Date;
  memberId?: string | null;
  sendAfter?: Date | null;
}

export interface StatusChange {
  orgId: string;
  platformMessageId: string;
  /** Our row id, as WhatsApp echoes it back (ADR-0086): settles a send whose answer we never read. */
  callbackRef: string | null;
  state: MessageState;
  errorCode: string | null;
}

export const messageRepository = {
  /** Answers the ids actually written: a row whose dedupe key is already stored is skipped, not repeated. */
  async insert(tx: Tx, rows: readonly NewMessage[]): Promise<Set<string>> {
    if (rows.length === 0) return new Set();
    const written = await tx.message.createManyAndReturn({ data: [...rows], skipDuplicates: true, select: { id: true } });
    return new Set(written.map((row) => row.id));
  },

  /**
   * Raises our sent message to the status Meta reports, never lowers it (READ never returns to
   * DELIVERED), in one conditional statement. Answers the conversations whose rows moved.
   */
  async applyStatus(tx: Tx, change: StatusChange): Promise<string[]> {
    const below = statesBelow(change.state);
    if (below.length === 0) return [];
    const byCallback = change.callbackRef ? Prisma.sql`OR "id" = ${change.callbackRef}` : Prisma.empty;
    const rows = await tx.$queryRaw<Array<{ conversationId: string }>>`
      UPDATE "Message"
      SET "state" = ${change.state},
          "errorCode" = COALESCE(${change.errorCode}, "errorCode"),
          "platformMessageId" = COALESCE("platformMessageId", ${change.platformMessageId}),
          "changeSeq" = nextval('"Message_changeSeq_seq"'),
          "updatedAt" = timezone('UTC', now())
      WHERE "orgId" = ${change.orgId}
        AND ("platformMessageId" = ${change.platformMessageId} ${byCallback})
        AND "state" IN (${Prisma.join(below)})
      RETURNING "conversationId"`;
    return rows.map((row) => row.conversationId);
  },

  /** Whether a row in this shop already carries this platform id: our own send, echoed back. */
  async hasPlatformId(orgId: string, platformMessageId: string): Promise<boolean> {
    return (await prisma.message.count({ where: { orgId, platformMessageId } })) > 0;
  },
};

/** A shared thread's newest messages, sealed, for support's one open under a live grant (D9). */
export const sharedThread = {
  async newest(conversationId: string, take: number) {
    const rows = await prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      select: { id: true, direction: true, author: true, kind: true, label: true, bodySealed: true, sentAt: true },
      take,
    });
    return rows.reverse();
  },
};

/** The thread a send goes to, read with the message (inbox-core D6). */
export interface SendRow {
  id: string;
  orgId: string;
  conversationId: string;
  author: string;
  kind: string;
  bodySealed: string | null;
  attachmentRef: string | null;
  state: string | null;
  sendAfter: Date | null;
  sendAttempts: number;
  conversation: {
    connectionId: string;
    platform: string;
    kind: string;
    personKey: string;
    threadKey: string;
    postRef: string | null;
    lastInboundAt: Date | null;
  };
}

const SEND_SELECT = {
  id: true,
  orgId: true,
  conversationId: true,
  author: true,
  kind: true,
  bodySealed: true,
  attachmentRef: true,
  state: true,
  sendAfter: true,
  sendAttempts: true,
  conversation: {
    select: { connectionId: true, platform: true, kind: true, personKey: true, threadKey: true, postRef: true, lastInboundAt: true },
  },
} as const;

type Db = Tx | typeof prisma;

/**
 * One conditional step of an outbound row's life (A-D8): only from the states named, in this shop,
 * with a fresh `changeSeq`. Answers the row's conversation when it moved, so the caller bumps it.
 */
async function move(db: Db, orgId: string, id: string, from: readonly MessageState[], set: Prisma.Sql, extra: Prisma.Sql = Prisma.empty) {
  const rows = await db.$queryRaw<Array<{ conversationId: string; sendAttempts: number }>>`
    UPDATE "Message"
    SET ${set},
        "changeSeq" = nextval('"Message_changeSeq_seq"'),
        "updatedAt" = timezone('UTC', now())
    WHERE "id" = ${id} AND "orgId" = ${orgId} AND "state" IN (${Prisma.join([...from])}) ${extra}
    RETURNING "conversationId", "sendAttempts"`;
  return rows[0] ?? null;
}

export const outboxRepository = {
  async find(orgId: string, id: string): Promise<SendRow | null> {
    return await prisma.message.findFirst({ where: { id, orgId }, select: SEND_SELECT });
  },

  /** A member's double tap names the same client id, so finds the row the first tap made. */
  async findByDedupe(orgId: string, dedupeKey: string): Promise<SendRow | null> {
    return await prisma.message.findFirst({ where: { dedupeKey, orgId }, select: SEND_SELECT });
  },

  /** Undo (Q16): only a held row, so exactly one of Undo and the send wins the race. */
  cancelHeld: (tx: Tx, orgId: string, id: string) =>
    move(tx, orgId, id, [MESSAGE_STATE.HELD], Prisma.sql`"state" = ${MESSAGE_STATE.CANCELLED}`),

  /** The hold is over: the row joins the queue, on the database's clock. */
  releaseHeld: (tx: Tx, orgId: string, id: string) =>
    move(tx, orgId, id, [MESSAGE_STATE.HELD], Prisma.sql`"state" = ${MESSAGE_STATE.QUEUED}`, Prisma.sql`AND "sendAfter" <= timezone('UTC', now())`),

  /** Only a count of one calls the platform (ADR-0086); each claim is one try. */
  claim: (orgId: string, id: string) =>
    move(prisma, orgId, id, [MESSAGE_STATE.QUEUED], Prisma.sql`"state" = ${MESSAGE_STATE.CLAIMED}, "sendAttempts" = "sendAttempts" + 1`),

  /** Back in the queue without a call made (the lane was busy): the try is not counted. */
  unclaimUntried: (tx: Tx, orgId: string, id: string, notBefore: Date) =>
    move(tx, orgId, id, [MESSAGE_STATE.CLAIMED], Prisma.sql`"state" = ${MESSAGE_STATE.QUEUED}, "sendAttempts" = "sendAttempts" - 1, "sendAfter" = ${notBefore}`),

  /** The platform said it did not send: queued again for the one automatic retry (Q9). */
  requeueNotSent: (tx: Tx, orgId: string, id: string, errorCode: string, notBefore: Date) =>
    move(tx, orgId, id, [MESSAGE_STATE.CLAIMED], Prisma.sql`"state" = ${MESSAGE_STATE.QUEUED}, "errorCode" = ${errorCode}, "sendAfter" = ${notBefore}`),

  /**
   * Sent at the platform's answer, also over an UNCERTAIN a second run of the job wrote meanwhile. A
   * status may have raised the row already (WhatsApp echoes our id): it still takes the platform's id.
   */
  async markSent(tx: Tx, orgId: string, id: string, platformMessageId: string, at: Date): Promise<string | null> {
    const moved = await move(
      tx,
      orgId,
      id,
      [MESSAGE_STATE.CLAIMED, MESSAGE_STATE.UNCERTAIN],
      Prisma.sql`"state" = ${MESSAGE_STATE.SENT}, "platformMessageId" = ${platformMessageId}, "errorCode" = NULL, "sentAt" = ${at}`,
    );
    if (moved) return moved.conversationId;
    await tx.$executeRaw`
      UPDATE "Message" SET "platformMessageId" = ${platformMessageId}, "changeSeq" = nextval('"Message_changeSeq_seq"'), "updatedAt" = timezone('UTC', now())
      WHERE "id" = ${id} AND "orgId" = ${orgId} AND "platformMessageId" IS NULL`;
    return null;
  },

  markFailed: (tx: Tx, orgId: string, id: string, from: readonly MessageState[], errorCode: string) =>
    move(tx, orgId, id, from, Prisma.sql`"state" = ${MESSAGE_STATE.FAILED}, "errorCode" = ${errorCode}`),

  markUncertain: (tx: Tx, orgId: string, id: string) =>
    move(tx, orgId, id, [MESSAGE_STATE.CLAIMED], Prisma.sql`"state" = ${MESSAGE_STATE.UNCERTAIN}`),

  /** Try again (R9): the same row, queued afresh with its automatic retry restored. */
  requeueFailed: (tx: Tx, orgId: string, id: string) =>
    move(tx, orgId, id, [MESSAGE_STATE.FAILED], Prisma.sql`"state" = ${MESSAGE_STATE.QUEUED}, "sendAttempts" = 0, "errorCode" = NULL, "sendAfter" = NULL`),
};
