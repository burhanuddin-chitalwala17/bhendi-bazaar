import { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { statesBelow, type InboxMessageKind, type MessageAuthor, type MessageDirection, type MessageState } from "./inbox.types";

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
