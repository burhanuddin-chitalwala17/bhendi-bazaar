import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

export const drainEventsPayload = z.object({ connectionId: z.string(), orgId: z.string() });
export type DrainEventsPayload = z.infer<typeof drainEventsPayload>;

/**
 * One connection's stored Meta events handed on in order (ADR-0078 decision 3), enqueued by the
 * intake and by itself while events remain. Its handler is in channels.jobs.ts.
 */
export const drainEventsSpec: JobSpec<DrainEventsPayload> = {
  type: "channels.drain-events",
  schema: drainEventsPayload,
  group: (payload) => payload.orgId,
};
