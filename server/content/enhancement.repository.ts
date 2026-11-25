import { EnhancementState, type EnhancementTool, type Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { ENHANCEMENT_STATE, USAGE_STATES, type EnhancementRow, type TimeWindow } from "@server/content/enhancement.types";

/** A Prisma client or the transaction client a caller is already inside. */
export type EnhancementDb = Pick<typeof prisma, "enhancement">;

const ENHANCEMENT_SELECT = {
  id: true,
  orgId: true,
  requesterId: true,
  sourceAssetId: true,
  tool: true,
  preset: true,
  provider: true,
  state: true,
  slot: true,
  proposalKey: true,
  resultAssetId: true,
  costPaise: true,
  error: true,
  brief: true,
  referenceRefs: true,
  aspect: true,
  purpose: true,
  previousId: true,
  createdAt: true,
  proposedAt: true,
  decidedAt: true,
  // The two URLs the portal needs beside the row: what was improved, and what came of it.
  sourceAsset: { select: { ref: true } },
  resultAsset: { select: { ref: true } },
} satisfies Prisma.EnhancementSelect;

/** One org's month as the owner's table reads it, before the org's name is put beside it. */
export interface OrgUsageRow {
  orgId: string;
  used: number;
  spentPaise: number;
}

export interface CreateEnhancementInput {
  orgId: string;
  requesterId: string | null;
  sourceAssetId: string;
  tool: EnhancementTool;
  preset: string | null;
  provider: string;
  slot: string | null;
  brief?: string | null;
  referenceRefs?: string[];
  aspect?: string | null;
  purpose?: string | null;
  previousId?: string | null;
}

/**
 * The one reader and writer of `Enhancement` (ADR-0003, image-enhancement trd D1). Every state
 * change is one conditional statement from the state it may leave, so a redelivered job or a
 * double-tapped button moves nothing the second time (ADR-0038 D4) and reports so. Nothing here
 * deletes: a run that was asked for is a fact the quota and the spend report both count.
 */
export class EnhancementRepository {
  async create(input: CreateEnhancementInput, db: EnhancementDb = prisma): Promise<EnhancementRow> {
    return await db.enhancement.create({
      data: { ...input, state: EnhancementState.REQUESTED },
      select: ENHANCEMENT_SELECT,
    });
  }

  async findForOrg(orgId: string, id: string): Promise<EnhancementRow | null> {
    return await prisma.enhancement.findFirst({ where: { id, orgId }, select: ENHANCEMENT_SELECT });
  }

  async countAwaitingDecision(orgId: string): Promise<number> {
    return await prisma.enhancement.count({ where: { orgId, state: ENHANCEMENT_STATE.PROPOSED } });
  }

  /** How many runs of a tool one shop asked for since `since` — the per-minute limit's count. */
  async countRecent(orgId: string, tool: EnhancementTool, since: Date): Promise<number> {
    return await prisma.enhancement.count({ where: { orgId, tool, createdAt: { gte: since } } });
  }

  /** One shop's runs of a tool still asked-for or running since before `before` — a hold left open (improve-with-ai D6). */
  async findStale(orgId: string, tool: EnhancementTool, before: Date): Promise<Array<{ id: string }>> {
    return await prisma.enhancement.findMany({
      where: { orgId, tool, state: { in: [EnhancementState.REQUESTED, EnhancementState.RUNNING] }, createdAt: { lt: before } },
      select: { id: true },
      take: 20,
    });
  }

  /** For the worker, which is handed an id and no org. */
  async findById(id: string): Promise<EnhancementRow | null> {
    return await prisma.enhancement.findUnique({ where: { id }, select: ENHANCEMENT_SELECT });
  }

  /** Use is a count, never a counter (trd D5): the org's rows in the window, in the states that count. */
  async countUsage(orgId: string, window: TimeWindow): Promise<number> {
    return await prisma.enhancement.count({
      where: { orgId, createdAt: { gte: window.start, lt: window.end }, state: { in: [...USAGE_STATES] } },
    });
  }

  /**
   * What every org together spent on runs asked for in the window, in paise (trd D5, D6). Keyed on
   * the request time rather than the moment of spend: a run finishes within its minute, and the
   * request is the act the cap exists to stop.
   */
  async sumCostPaise(window: TimeWindow): Promise<number> {
    const result = await prisma.enhancement.aggregate({
      _sum: { costPaise: true },
      where: { createdAt: { gte: window.start, lt: window.end } },
    });
    return result._sum.costPaise ?? 0;
  }

  /**
   * Cut-outs the free image host made in the window (generation-foundation trd D11): every run of a
   * tool that segments, except those the paid model cut. A scene's row names its painter, not its
   * cutter, so a scene counts as the host's — an overcount, never an undercount, of absorbed spend.
   */
  async countHostCutouts(window: TimeWindow, tools: readonly EnhancementTool[], paidProvider: string): Promise<number> {
    return await prisma.enhancement.count({
      where: {
        createdAt: { gte: window.start, lt: window.end },
        tool: { in: [...tools] },
        provider: { not: paidProvider },
      },
    });
  }

  /**
   * Every org's use and spend in one window, in one grouped query (spec R7) — the platform owner's
   * table is never a query per org. Grouped by state as well as by org because the two numbers
   * count different rows: the month's use is the states that hold a slot, while the spend is every
   * row, since a discarded or failed run still cost what it cost (trd D5, D6).
   */
  async usageByOrg(window: TimeWindow): Promise<OrgUsageRow[]> {
    const groups = await prisma.enhancement.groupBy({
      by: ["orgId", "state"],
      where: { createdAt: { gte: window.start, lt: window.end } },
      _count: { _all: true },
      _sum: { costPaise: true },
    });

    const byOrg = new Map<string, OrgUsageRow>();
    for (const group of groups) {
      const row = byOrg.get(group.orgId) ?? { orgId: group.orgId, used: 0, spentPaise: 0 };
      row.spentPaise += group._sum.costPaise ?? 0;
      if ((USAGE_STATES as readonly string[]).includes(group.state)) row.used += group._count._all;
      byOrg.set(group.orgId, row);
    }
    return [...byOrg.values()];
  }

  /**
   * The worker takes the run. From REQUESTED, or from RUNNING: a worker that died mid-run leaves the
   * row there, and the retried job must be able to pick it up — the tools are deterministic and the
   * proposal's key fixed, so resuming writes the same object.
   */
  async markRunning(id: string): Promise<boolean> {
    const result = await prisma.enhancement.updateMany({
      where: { id, state: { in: [EnhancementState.REQUESTED, EnhancementState.RUNNING] } },
      data: { state: EnhancementState.RUNNING },
    });
    return result.count === 1;
  }

  /** The provider is written here and not at creation: until the run happens, nothing has performed it. */
  async markProposed(
    id: string,
    proposal: { proposalKey: string; provider: string; costPaise: number; proposedAt: Date },
  ): Promise<boolean> {
    const result = await prisma.enhancement.updateMany({
      where: { id, state: EnhancementState.RUNNING },
      data: { state: EnhancementState.PROPOSED, ...proposal },
    });
    return result.count === 1;
  }

  /** A refusal the org member reads (spec R10); anything that might succeed on retry never lands here. */
  /** `costPaise` is what the platform spent before the failure — a paint already paid for (generation-foundation D6). */
  async markFailed(id: string, error: string, costPaise = 0): Promise<boolean> {
    const result = await prisma.enhancement.updateMany({
      where: { id, state: { in: [EnhancementState.REQUESTED, EnhancementState.RUNNING] } },
      data: { state: EnhancementState.FAILED, error, costPaise },
    });
    return result.count === 1;
  }

  async markAccepted(id: string, decision: { resultAssetId: string; decidedAt: Date }): Promise<boolean> {
    const result = await prisma.enhancement.updateMany({
      where: { id, state: EnhancementState.PROPOSED },
      data: { state: EnhancementState.ACCEPTED, ...decision },
    });
    return result.count === 1;
  }

  async markDiscarded(id: string, decidedAt: Date): Promise<boolean> {
    const result = await prisma.enhancement.updateMany({
      where: { id, state: EnhancementState.PROPOSED },
      data: { state: EnhancementState.DISCARDED, decidedAt },
    });
    return result.count === 1;
  }
}

export const enhancementRepository = new EnhancementRepository();
