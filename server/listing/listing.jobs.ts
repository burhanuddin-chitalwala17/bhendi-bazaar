import { registerJob } from "@server/shared/jobs/jobs.registry";
import { completenessSpec } from "@server/shared/jobs/completeness.job";

import { completenessService } from "./completeness.service";

/** Recomputes completeness for some or all of a shop's products (listing-model/dynamic-form D3). */
export const completenessJob = registerJob({
  ...completenessSpec,
  handler: async ({ jobId, payload }) => {
    const count = await completenessService.refresh(payload.orgId, payload.productIds);
    console.log(`[jobs] listing.refresh-completeness ${jobId}: ${JSON.stringify({ org: payload.orgId, products: count })}`);
  },
});

