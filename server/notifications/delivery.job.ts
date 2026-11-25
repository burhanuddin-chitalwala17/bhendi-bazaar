import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

export const deliverPayload = z.object({ deliveryId: z.string() });
export type DeliverPayload = z.infer<typeof deliverPayload>;

/** "Send this delivery" (notifications-core D2), enqueued in the emitter's transaction; handler in `notifications.jobs.ts`. */
export const deliverSpec: JobSpec<DeliverPayload> = {
  type: "notify.deliver",
  schema: deliverPayload,
};
