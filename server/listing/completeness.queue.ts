import { enqueue, enqueueMany } from "@server/shared/jobs/jobs.enqueue";
import { completenessSpec } from "@server/shared/jobs/completeness.job";
import { prisma } from "@server/shared/prisma";

/**
 * Asks for completeness to be recomputed (listing-model/dynamic-form D3). A save never fails because the
 * ask did: the next save, connect or map change asks again, and the miss is logged.
 */
export async function askCompleteness(orgIds: readonly string[], productIds?: readonly string[]): Promise<void> {
  try {
    if (orgIds.length === 1) await enqueue(prisma, completenessSpec, { orgId: orgIds[0], ...(productIds ? { productIds: [...productIds] } : {}) });
    else if (orgIds.length > 1) await enqueueMany(prisma, completenessSpec, orgIds.map((orgId) => ({ orgId })));
  } catch (error) {
    console.error(`[listing] completeness not queued: ${error instanceof Error ? error.name : "error"}`);
  }
}
