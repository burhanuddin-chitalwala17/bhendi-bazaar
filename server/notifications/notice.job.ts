import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

export const noticeSendPayload = z.object({ noticeId: z.string() });
export type NoticeSendPayload = z.infer<typeof noticeSendPayload>;

/**
 * "Send this notice" (order-fulfilment D8). Nothing enqueues it since parcel notices moved onto the hub (D6);
 * it stays registered so a job queued before that migration still sends its notice, now a delivery of the same id.
 */
export const noticeSendSpec: JobSpec<NoticeSendPayload> = {
  type: "notify.send",
  schema: noticeSendPayload,
};
