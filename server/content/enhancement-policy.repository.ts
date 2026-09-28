import { prisma } from "@server/shared/prisma";

export interface EnhancementPolicy {
  /** Null is "whatever the platform's default is": a row records a deviation, never a copy. */
  monthlyAllowance: number | null;
  pausedAt: Date | null;
  pauseReason: string | null;
}

export interface OrgEnhancementPolicyRow extends EnhancementPolicy {
  orgId: string;
}

/** What an org with no row of its own stands at: no deviation, not paused (trd D5). */
export const NO_ENHANCEMENT_POLICY: EnhancementPolicy = {
  monthlyAllowance: null,
  pausedAt: null,
  pauseReason: null,
};

const POLICY_SELECT = { monthlyAllowance: true, pausedAt: true, pauseReason: true } as const;

/**
 * The one reader and writer of `OrgEnhancementPolicy` (ADR-0003). A row exists only where the
 * platform owner has said something that differs from the platform's own numbers — a different
 * allowance, or a pause — so most orgs have none and resolve to the default. Use is never here:
 * it is a count of `Enhancement` rows (trd D5).
 */
export class EnhancementPolicyRepository {
  async policyFor(orgId: string): Promise<EnhancementPolicy> {
    const row = await prisma.orgEnhancementPolicy.findUnique({ where: { orgId }, select: POLICY_SELECT });
    return row ?? NO_ENHANCEMENT_POLICY;
  }

  /** Every deviation on the platform, for the owner's table. Small by design: no page needed. */
  async list(): Promise<OrgEnhancementPolicyRow[]> {
    return await prisma.orgEnhancementPolicy.findMany({ select: { orgId: true, ...POLICY_SELECT } });
  }

  async save(orgId: string, policy: EnhancementPolicy): Promise<EnhancementPolicy> {
    return await prisma.orgEnhancementPolicy.upsert({
      where: { orgId },
      create: { orgId, ...policy },
      update: policy,
      select: POLICY_SELECT,
    });
  }

  /** An org back at the platform's numbers keeps no row — there would be nothing in it. */
  async remove(orgId: string): Promise<void> {
    await prisma.orgEnhancementPolicy.deleteMany({ where: { orgId } });
  }
}

export const enhancementPolicyRepository = new EnhancementPolicyRepository();
