import { registerJob } from "@server/shared/jobs/jobs.registry";
import { orgEmailChangedSpec } from "@server/shared/jobs/org-email-changed.job";
import { emailService } from "@server/notifications/email.service";

/**
 * The notice to a shop's old address (org-profile D7, Q25). Idempotent on the job id: the
 * provider's idempotency key is derived from it, so at-least-once delivery sends one email.
 */
export const orgEmailChangedJob = registerJob({
  ...orgEmailChangedSpec,
  handler: async ({ jobId, payload }) => {
    await emailService.sendOrgEmailChanged(payload.oldEmail, { shopName: payload.shopName }, jobId);
  },
});
