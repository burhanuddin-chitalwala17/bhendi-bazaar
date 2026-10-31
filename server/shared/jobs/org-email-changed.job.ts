import { z } from "zod";
import type { JobSpec } from "./jobs.types";

export const orgEmailChangedPayload = z.object({
  orgId: z.string().min(1),
  shopName: z.string().min(1).max(200),
  // A legacy address may predate the email rule; the notice must not refuse to queue over it.
  oldEmail: z.string().trim().min(3).max(255),
});
export type OrgEmailChangedPayload = z.infer<typeof orgEmailChangedPayload>;

/**
 * "Your shop's email was changed" (org-profile D7, Q16, Q25), enqueued by catalog in the transaction
 * that changed the address, so catalog never imports notifications. The handler is notifications'.
 */
export const orgEmailChangedSpec: JobSpec<OrgEmailChangedPayload> = {
  type: "org.email-changed",
  schema: orgEmailChangedPayload,
  group: (payload) => payload.orgId,
};
