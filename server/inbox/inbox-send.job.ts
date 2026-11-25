import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

export const inboxSendPayload = z.object({ messageId: z.string(), orgId: z.string() });
export type InboxSendPayload = z.infer<typeof inboxSendPayload>;

/**
 * One outbound message taken from its row to the platform (inbox-core D6): enqueued with the row, to
 * start when its hold ends, so a closed tab still sends (A8). Its handler is in `inbox.jobs.ts`.
 */
export const inboxSendSpec: JobSpec<InboxSendPayload> = {
  type: "inbox.send",
  schema: inboxSendPayload,
  group: (payload) => payload.orgId,
};
