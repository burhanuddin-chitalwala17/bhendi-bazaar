import { z } from "zod";

import type { JobSpec } from "@server/shared/jobs/jobs.types";

export const ticketResolvedPayload = z.object({ ticketId: z.string() });

/**
 * "A ticket was resolved" (setup-requests D12): enqueued in the transaction that resolved it. Its
 * handler stamps the needs it told; the bell reads that once PR #57 lands (Q19).
 */
export const ticketResolvedSpec: JobSpec<z.infer<typeof ticketResolvedPayload>> = {
  type: "requests.ticket-resolved",
  schema: ticketResolvedPayload,
};

export { requestsDailySpec } from "@server/shared/jobs/listing-complaints.job";
