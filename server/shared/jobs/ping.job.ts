import { z } from "zod";
import { registerJob } from "./jobs.registry";

/**
 * The no-op job: proves the whole path — enqueue in a transaction, notify, fetch, parse,
 * run — with nothing at stake. Kept after the real jobs arrive as the smoke test.
 */
export const pingJob = registerJob({
  type: "ping",
  schema: z.object({ note: z.string().max(200).optional() }),
  handler: async ({ jobId, payload }) => {
    console.log(`[jobs] ping ${jobId}${payload.note ? `: ${payload.note}` : ""}`);
  },
});
