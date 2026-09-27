import { prisma } from "@server/shared/prisma";
import { DEFAULT_MONTHLY_ALLOWANCE } from "@server/content/enhancement.types";

export interface EnhancementPolicy {
  monthlyAllowance: number;
  pausedAt: Date | null;
  pauseReason: string | null;
}

/** What an org without a row gets (image-enhancement trd D5): the declared allowance, not paused. */
export const DEFAULT_ENHANCEMENT_POLICY: EnhancementPolicy = {
  monthlyAllowance: DEFAULT_MONTHLY_ALLOWANCE,
  pausedAt: null,
  pauseReason: null,
};

const POLICY_SELECT = { monthlyAllowance: true, pausedAt: true, pauseReason: true } as const;

/**
 * The one reader and writer of `OrgEnhancementPolicy` (ADR-0003). A row exists only once the
 * platform owner has said something about an org — paused it, or set its allowance — so most orgs
 * have none and read the defaults. Use is never here: it is a count of `Enhancement` rows (trd D5).
 */
export class EnhancementPolicyRepository {
  async policyFor(orgId: string): Promise<EnhancementPolicy> {
    const row = await prisma.orgEnhancementPolicy.findUnique({ where: { orgId }, select: POLICY_SELECT });
    return row ?? DEFAULT_ENHANCEMENT_POLICY;
  }

  /** Stop one org's enhancement, with the reason its members will read (spec R7, A5). */
  async pause(orgId: string, reason: string, now: Date = new Date()): Promise<EnhancementPolicy> {
    return await prisma.orgEnhancementPolicy.upsert({
      where: { orgId },
      create: { orgId, monthlyAllowance: DEFAULT_MONTHLY_ALLOWANCE, pausedAt: now, pauseReason: reason },
      update: { pausedAt: now, pauseReason: reason },
      select: POLICY_SELECT,
    });
  }

  /** Lift the pause. An org with no row was never paused, so there is nothing to move. */
  async resume(orgId: string): Promise<EnhancementPolicy> {
    await prisma.orgEnhancementPolicy.updateMany({ where: { orgId }, data: { pausedAt: null, pauseReason: null } });
    return await this.policyFor(orgId);
  }
}

export const enhancementPolicyRepository = new EnhancementPolicyRepository();
