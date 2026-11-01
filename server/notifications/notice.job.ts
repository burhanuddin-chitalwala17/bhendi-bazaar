import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

export const noticeSendPayload = z.object({ noticeId: z.string() });
export type NoticeSendPayload = z.infer<typeof noticeSendPayload>;

/**
 * "Send this notice" (order-fulfilment D8), enqueued in the transaction that wrote it. The handler
 * is in `notifications.jobs.ts`, which only the worker imports.
 */
export const noticeSendSpec: JobSpec<NoticeSendPayload> = {
  type: "notify.send",
  schema: noticeSendPayload,
};
