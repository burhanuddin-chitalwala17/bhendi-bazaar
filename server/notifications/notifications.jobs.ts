import { registerJob } from "@server/shared/jobs/jobs.registry";
import { orgEmailChangedSpec } from "@server/shared/jobs/org-email-changed.job";
import { emailService } from "@server/notifications/email.service";
import { noticeSendSpec } from "@server/notifications/notice.job";
import { noticeService } from "@server/notifications/notice.service";
import { deliverSpec } from "@server/notifications/delivery.job";
import { notificationsService } from "@server/notifications/notifications.service";

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

/** Sends one parcel notice. Idempotent on the notice, not the job: a repeat delivery finds it sent (ADR-0038 D4). */
export const noticeSendJob = registerJob({
  ...noticeSendSpec,
  handler: ({ payload }) => noticeService.send(payload.noticeId),
});

/** Sends one hub delivery. Idempotent on the delivery, not the job: a settled row is skipped (notifications-core D2). */
export const deliverJob = registerJob({
  ...deliverSpec,
  handler: ({ payload }) => notificationsService.deliver(payload.deliveryId),
});
