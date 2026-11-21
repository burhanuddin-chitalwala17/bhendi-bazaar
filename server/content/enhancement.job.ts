import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs";

export const enhancementPayload = z.object({
  enhancementId: z.string().trim().min(1).max(64),
  /** The org whose fairness bucket this run counts against (worker-foundation spec R4). */
  orgId: z.string().trim().min(1).max(64),
});
export type EnhancementPayload = z.infer<typeof enhancementPayload>;

/**
 * The run as the web app enqueues it (image-enhancement trd D9): name, payload, group. The handler
 * lives in enhancement.jobs.ts, which only the worker imports, so a request never loads a tool's
 * pipeline into the web process and registers nothing there.
 */
export const enhancementSpec: JobSpec<EnhancementPayload> = {
  type: "image.enhance",
  schema: enhancementPayload,
  group: (payload) => payload.orgId,
  // Bounded, with backoff: a run that keeps failing is given up within about half an hour, and an
  // AI picture's credit is then refunded rather than held for ever (improve-with-ai D6).
  retry: { limit: 5, delaySeconds: 30 },
};
