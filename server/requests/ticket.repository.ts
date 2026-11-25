import { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

import { CLOSED_REASON, TICKET_STATUS, type ClosedReason, type TicketType } from "./request.types";

type Db = Prisma.TransactionClient | typeof prisma;

/** A ticket to raise and one shop's need for it, already keyed (D3). */
export interface RaiseRow {
  key: string;
  type: TicketType;
  kind: string;
  subject: unknown;
  orgId: string;
  productId: string;
  detail: unknown;
  category: string | null;
  words: string | null;
}

export interface TicketRow {
  id: string;
  type: string;
  kind: string;
  key: string;
  status: string;
  subject: unknown;
  closedReason: string | null;
  openedAt: Date;
  resolvedAt: Date | null;
  reopenedAt: Date | null;
}

const SELECT = { id: true, type: true, kind: true, key: true, status: true, subject: true, closedReason: true, openedAt: true, resolvedAt: true, reopenedAt: true } as const;

/** A "not now" stays closed this long before a new error may raise it again (Q11). */
const NOT_NOW_DAYS = 30;

/** The one writer of `Ticket` and `TicketNeed` (Invariant 5). */
export const ticketRepository = {
  /**
   * Every ticket and need in two statements, however many shops (D3, D5). A ticket is upserted by key:
   * a done one reopens (Q12), a closed "not now" stays closed for 30 days (Q11), a "no longer needed"
   * reopens. A fields ticket's attributes grow by union. A need is inserted once per (ticket, org, product).
   */
  async raise(rows: readonly RaiseRow[], now: Date, options: { reopen: boolean } = { reopen: true }): Promise<number> {
    if (rows.length === 0) return 0;
    // Sorted by key, so two batches lock tickets in the same order and never deadlock.
    const tickets = [...new Map(rows.map((r) => [r.key, { key: r.key, type: r.type, kind: r.kind, subject: r.subject }])).values()].sort((a, b) => a.key.localeCompare(b.key));
    const notNowBefore = new Date(now.getTime() - NOT_NOW_DAYS * 86_400_000);
    // A standing complaint (the daily look) never reopens a done ticket: only a fresh send or report does (Q12).
    const reopen = options.reopen;
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "Ticket" ("id", "type", "kind", "key", "status", "subject", "openedAt", "updatedAt")
        SELECT gen_random_uuid()::text, t."type", t."kind", t."key", ${TICKET_STATUS.OPEN}, t."subject", ${now}, ${now}
        FROM jsonb_to_recordset(${JSON.stringify(tickets)}::jsonb) AS t("key" text, "type" text, "kind" text, "subject" jsonb)
        ON CONFLICT ("key") DO UPDATE SET
          "subject" = CASE
            WHEN jsonb_exists("Ticket"."subject", 'attributes') THEN jsonb_set("Ticket"."subject", '{attributes}',
              (SELECT to_jsonb(array_agg(DISTINCT a ORDER BY a)) FROM jsonb_array_elements_text(("Ticket"."subject"->'attributes') || (EXCLUDED."subject"->'attributes')) a))
            ELSE "Ticket"."subject" END,
          "status" = CASE
            WHEN "Ticket"."status" = ${TICKET_STATUS.DONE} AND ${reopen} THEN ${TICKET_STATUS.OPEN}
            WHEN "Ticket"."status" = ${TICKET_STATUS.CLOSED} AND ("Ticket"."closedReason" = ${CLOSED_REASON.NOT_NEEDED} OR "Ticket"."resolvedAt" < ${notNowBefore}) THEN ${TICKET_STATUS.OPEN}
            ELSE "Ticket"."status" END,
          "reopenedAt" = CASE WHEN "Ticket"."status" = ${TICKET_STATUS.DONE} AND ${reopen} THEN ${now} ELSE "Ticket"."reopenedAt" END,
          "closedReason" = CASE
            WHEN "Ticket"."status" = ${TICKET_STATUS.CLOSED} AND ("Ticket"."closedReason" = ${CLOSED_REASON.NOT_NEEDED} OR "Ticket"."resolvedAt" < ${notNowBefore}) THEN NULL
            ELSE "Ticket"."closedReason" END,
          "updatedAt" = ${now}`;
      // One row per (ticket, shop, product): two errors on one product with the same code are one need,
      // and ON CONFLICT cannot touch a row twice in one statement.
      const needs = [...new Map(rows.map((r) => [`${r.key}\u0000${r.orgId}\u0000${r.productId}`, { key: r.key, orgId: r.orgId, productId: r.productId, detail: r.detail ?? null, category: r.category, words: r.words }])).values()];
      return await tx.$executeRaw`
        INSERT INTO "TicketNeed" ("id", "ticketId", "orgId", "productId", "detail", "category", "words", "raisedAt")
        SELECT gen_random_uuid()::text, t."id", n."orgId", n."productId", n."detail", n."category", n."words", ${now}
        FROM jsonb_to_recordset(${JSON.stringify(needs)}::jsonb) AS n("key" text, "orgId" text, "productId" text, "detail" jsonb, "category" text, "words" text)
        JOIN "Ticket" t ON t."key" = n."key"
        ON CONFLICT ("ticketId", "orgId", "productId") DO UPDATE SET
          "detail" = COALESCE(EXCLUDED."detail", "TicketNeed"."detail"),
          "category" = COALESCE(EXCLUDED."category", "TicketNeed"."category"),
          "words" = COALESCE(EXCLUDED."words", "TicketNeed"."words"),
          -- Told again only once the ticket is open again; a "not now" re-raised daily keeps its stamp.
          "notifiedAt" = CASE WHEN (SELECT tk."status" FROM "Ticket" tk WHERE tk."id" = "TicketNeed"."ticketId") = ${TICKET_STATUS.OPEN} THEN NULL ELSE "TicketNeed"."notifiedAt" END`;
    });
  },

  async byId(id: string, db: Db = prisma): Promise<TicketRow | null> {
    return await db.ticket.findUnique({ where: { id }, select: SELECT });
  },

  /** Open requirements of some kinds, for the daily resolution check (D9). One read. */
  async openOfKinds(kinds: readonly string[]): Promise<TicketRow[]> {
    return await prisma.ticket.findMany({ where: { status: TICKET_STATUS.OPEN, kind: { in: [...kinds] } }, select: SELECT });
  },

  /** The inbox: a page of one type, with how many shops wait on each (Q28). Needs are counted, never read (Q3). */
  async inbox(type: TicketType, input: { resolved: boolean; search: string | null; skip: number; take: number }) {
    const where: Prisma.TicketWhereInput = {
      type,
      status: input.resolved ? { in: [TICKET_STATUS.DONE, TICKET_STATUS.CLOSED] } : TICKET_STATUS.OPEN,
      ...(input.search ? { key: { contains: input.search.toLowerCase(), mode: "insensitive" } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.ticket.findMany({ where, select: { ...SELECT, _count: { select: { needs: true } } }, orderBy: [{ needs: { _count: "desc" } }, { openedAt: "asc" }], skip: input.skip, take: input.take }),
      prisma.ticket.count({ where }),
    ]);
    return { rows, total };
  },

  async counts(): Promise<Record<TicketType, number>> {
    const rows = await prisma.ticket.groupBy({ by: ["type"], where: { status: TICKET_STATUS.OPEN }, _count: { _all: true } });
    return Object.fromEntries(rows.map((r) => [r.type, r._count._all])) as Record<TicketType, number>;
  },

  /** An issue's reports: the one place a need's shop and words are read for the admin (Q22). */
  async reports(ticketId: string) {
    return await prisma.ticketNeed.findMany({
      where: { ticketId },
      select: { orgId: true, productId: true, category: true, words: true, detail: true, raisedAt: true, org: { select: { name: true } } },
      orderBy: { raisedAt: "desc" },
    });
  },

  async needCount(ticketId: string): Promise<number> {
    return await prisma.ticketNeed.count({ where: { ticketId } });
  },

  /** Whether the shop has a need on this ticket while it is open. */
  async isOpenForOrg(orgId: string, ticketId: string): Promise<boolean> {
    return (await prisma.ticketNeed.count({ where: { orgId, ticketId, ticket: { status: TICKET_STATUS.OPEN } } })) > 0;
  },

  /** One shop's tickets, newest first (Q25). */
  async forOrg(orgId: string, input: { productIds?: readonly string[]; take: number }) {
    return await prisma.ticketNeed.findMany({
      where: { orgId, ...(input.productIds ? { productId: { in: [...input.productIds] } } : {}) },
      select: { productId: true, raisedAt: true, category: true, words: true, ticket: { select: SELECT } },
      orderBy: { raisedAt: "desc" },
      take: input.take,
    });
  },

  /**
   * Resolve only while open (hazard *two taps*, D8): the second caller gets false. Runs inside Apply's
   * transaction, so the setup and the ticket move together.
   */
  async resolve(id: string, now: Date, db: Db = prisma): Promise<boolean> {
    const { count } = await db.ticket.updateMany({ where: { id, status: TICKET_STATUS.OPEN }, data: { status: TICKET_STATUS.DONE, resolvedAt: now } });
    return count === 1;
  },

  /** Many at once, for the daily check (D9): one statement. */
  async resolveMany(ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) return 0;
    const { count } = await prisma.ticket.updateMany({ where: { id: { in: [...ids] }, status: TICKET_STATUS.OPEN }, data: { status: TICKET_STATUS.DONE, resolvedAt: now } });
    return count;
  },

  async close(id: string, reason: ClosedReason, now: Date): Promise<boolean> {
    const { count } = await prisma.ticket.updateMany({ where: { id, status: TICKET_STATUS.OPEN }, data: { status: TICKET_STATUS.CLOSED, closedReason: reason, resolvedAt: now } });
    return count === 1;
  },

  /** The shops a resolved ticket has told (D12); the bell reads `notifiedAt` later. */
  async markNotified(ticketId: string, now: Date): Promise<number> {
    const { count } = await prisma.ticketNeed.updateMany({ where: { ticketId, notifiedAt: null }, data: { notifiedAt: now } });
    return count;
  },

  /** Shops with a marketplace connected, for the daily category raise (D5): from the needs side, never per shop. */
  async orgIdsWithNeeds(): Promise<string[]> {
    const rows = await prisma.ticketNeed.findMany({ select: { orgId: true }, distinct: ["orgId"] });
    return rows.map((r) => r.orgId);
  },

  /**
   * Needs whose product has left sale (archived, or gone) are dropped, and tickets left with none close
   * as not needed (Q13): the daily pass, two statements for every shop.
   */
  async dropLeftSale(now: Date): Promise<number> {
    return await prisma.$transaction(async (tx) => {
      const dropped = await tx.$queryRaw<Array<{ ticketId: string }>>`
        DELETE FROM "TicketNeed" n
        WHERE n."productId" <> '' AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p."id" = n."productId" AND p."archivedAt" IS NULL)
        RETURNING n."ticketId"`;
      const ids = [...new Set(dropped.map((d) => d.ticketId))];
      if (ids.length === 0) return 0;
      await tx.ticket.updateMany({
        where: { id: { in: ids }, status: TICKET_STATUS.OPEN, needs: { none: {} } },
        data: { status: TICKET_STATUS.CLOSED, closedReason: CLOSED_REASON.NOT_NEEDED, resolvedAt: now },
      });
      return dropped.length;
    });
  },

};
