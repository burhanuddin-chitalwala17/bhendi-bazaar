import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

export const whatsappSetupPayload = z.object({ connectionId: z.string(), orgId: z.string() });
export type WhatsAppSetupPayload = z.infer<typeof whatsappSetupPayload>;

/**
 * Making a claimed WhatsApp number ready (connect-whatsapp D3), enqueued by the sign-up in the
 * transaction that claims it. Its handler is unit 2's, in channels.jobs.ts.
 */
export const whatsappSetupSpec: JobSpec<WhatsAppSetupPayload> = {
  type: "channels.whatsapp-setup",
  schema: whatsappSetupPayload,
  group: (payload) => payload.orgId,
};
