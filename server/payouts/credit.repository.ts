import { CreditLineKind, type Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { STARTING_CREDIT_PAISE } from "@server/payouts/credit.types";

/**
 * The one reader and writer of `CreditLine`, `CreditSettings` and `OrgCreditPolicy` (ADR-0003;
 * ai-images/shop-credits D1, D2). Lines are only ever inserted: there is no update and no delete,
 * so the ledger is the history (R4). The balance is a sum, never a column (R1).
 */
export type CreditDb = Pick<typeof prisma, "creditLine" | "$executeRaw">;

const LINE_SELECT = {
  id: true,
  kind: true,
  amountPaise: true,
  providerCostPaise: true,
  marginBps: true,
  method: true,
  reference: true,
  paidOn: true,
  receiptRef: true,
  note: true,
  createdAt: true,
  reversedBy: { select: { id: true } },
} satisfies Prisma.CreditLineSelect;

export type CreditLineRow = Prisma.CreditLineGetPayload<{ select: typeof LINE_SELECT }>;

export interface NewCreditLine {
  orgId: string;
  kind: CreditLineKind;
  amountPaise: number;
  providerCostPaise?: number | null;
  marginBps?: number | null;
  enhancementId?: string | null;
  runKey?: string | null;
  method?: PaymentMethod | null;
  reference?: string | null;
  paidOn?: Date | null;
  receiptRef?: string | null;
  reversesId?: string | null;
  note?: string | null;
  createdByUserId?: string | null;
}

const PLATFORM = "platform";

export class CreditRepository {
  /**
   * Serialise every charge for one shop (D5): a transaction-scoped advisory lock on its id, so two
   * requests cannot both read the same balance and both spend it. Released at commit.
   */
  async lockOrg(orgId: string, db: CreditDb): Promise<void> {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`credit:${orgId}`}))`;
  }

  /** The one-time starting credit (D3), for any of these shops that has none yet. Idempotent. */
  async ensureGrants(orgIds: string[], db: CreditDb = prisma): Promise<void> {
    if (orgIds.length === 0) return;
    await db.creditLine.createMany({
      data: orgIds.map((orgId) => ({
        orgId,
        kind: CreditLineKind.GRANT,
        amountPaise: STARTING_CREDIT_PAISE,
        grantKey: orgId,
        note: "Starting credit",
      })),
      skipDuplicates: true,
    });
  }

  async balance(orgId: string, db: CreditDb = prisma): Promise<number> {
    const { _sum } = await db.creditLine.aggregate({ where: { orgId }, _sum: { amountPaise: true } });
    return _sum.amountPaise ?? 0;
  }

  async insert(line: NewCreditLine, db: CreditDb = prisma): Promise<{ id: string }> {
    return await db.creditLine.create({ data: line, select: { id: true } });
  }

  /**
   * A line keyed to a run (its charge, its one closing line): written once, whatever retries. False
   * when the key was already taken — the earlier write stands. `skipDuplicates` rather than catching
   * the unique violation, which would abort a caller's transaction in Postgres.
   */
  async insertOnce(line: NewCreditLine & { runKey: string }, db: CreditDb = prisma): Promise<boolean> {
    const { count } = await db.creditLine.createMany({ data: [line], skipDuplicates: true });
    return count === 1;
  }

  /** Newest first, one more than asked so the caller knows there is more. */
  async lines(orgId: string, take: number, skip = 0): Promise<CreditLineRow[]> {
    return await prisma.creditLine.findMany({
      where: { orgId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      skip,
      select: LINE_SELECT,
    });
  }

  async findLine(orgId: string, id: string): Promise<(CreditLineRow & { reversesId: string | null }) | null> {
    return await prisma.creditLine.findFirst({ where: { id, orgId }, select: { ...LINE_SELECT, reversesId: true } });
  }

  /** What one run's lines net to: its charge and any adjustment (D5). */
  /** Runs of one kind charged before `before` that have no closing line: a hold a dead process left open. */
  async openRuns(orgId: string, runPrefix: string, before: Date): Promise<string[]> {
    const charges = await prisma.creditLine.findMany({
      where: { orgId, kind: CreditLineKind.CHARGE, enhancementId: { startsWith: runPrefix }, createdAt: { lt: before } },
      select: { enhancementId: true },
      take: 50,
    });
    const runs = charges.flatMap((row) => (row.enhancementId ? [row.enhancementId] : []));
    if (runs.length === 0) return [];
    const closed = await prisma.creditLine.findMany({
      where: { runKey: { in: runs.map((run) => `close:${run}`) } },
      select: { enhancementId: true },
    });
    const done = new Set(closed.map((row) => row.enhancementId));
    return runs.filter((run) => !done.has(run));
  }

  async netForRun(enhancementId: string, db: CreditDb = prisma): Promise<{ orgId: string | null; paise: number; charge: { providerCostPaise: number | null; marginBps: number | null } | null }> {
    const rows = await db.creditLine.findMany({
      where: { enhancementId },
      select: { orgId: true, kind: true, amountPaise: true, providerCostPaise: true, marginBps: true },
    });
    const charge = rows.find((row) => row.kind === CreditLineKind.CHARGE) ?? null;
    return {
      orgId: rows[0]?.orgId ?? null,
      paise: rows.reduce((total, row) => total + row.amountPaise, 0),
      charge: charge ? { providerCostPaise: charge.providerCostPaise, marginBps: charge.marginBps } : null,
    };
  }

  /** What a shop's AI pictures took this month, net of adjustments and refunds (R8). */
  async spentSince(orgId: string, since: Date): Promise<number> {
    const { _sum } = await prisma.creditLine.aggregate({
      where: {
        orgId,
        createdAt: { gte: since },
        kind: { in: [CreditLineKind.CHARGE, CreditLineKind.ADJUSTMENT, CreditLineKind.REFUND] },
      },
      _sum: { amountPaise: true },
    });
    return -(_sum.amountPaise ?? 0);
  }

  async platformMarginBps(): Promise<number> {
    const row = await prisma.creditSettings.findUnique({ where: { id: PLATFORM }, select: { marginBps: true } });
    return row?.marginBps ?? 0;
  }

  async setPlatformMarginBps(marginBps: number): Promise<void> {
    await prisma.creditSettings.upsert({ where: { id: PLATFORM }, create: { id: PLATFORM, marginBps }, update: { marginBps } });
  }

  async orgMarginBps(orgId: string): Promise<number | null> {
    const row = await prisma.orgCreditPolicy.findUnique({ where: { orgId }, select: { marginBps: true } });
    return row?.marginBps ?? null;
  }

  /** Null removes the shop's own margin; a policy row records a deviation only (as OrgEnhancementPolicy). */
  async setOrgMarginBps(orgId: string, marginBps: number | null): Promise<void> {
    if (marginBps === null) {
      await prisma.orgCreditPolicy.deleteMany({ where: { orgId } });
      return;
    }
    await prisma.orgCreditPolicy.upsert({ where: { orgId }, create: { orgId, marginBps }, update: { marginBps } });
  }
}

export const creditRepository = new CreditRepository();
