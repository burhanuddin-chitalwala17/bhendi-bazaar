import { z } from "zod";
import { registerJob } from "@server/shared/jobs/jobs.registry";
import { registerSchedule } from "@server/shared/jobs/jobs.schedule";
import { JOBS_SCHEDULE_MIN_INTERVAL_SECONDS } from "@server/shared/jobs/jobs.config";
import { paymentService } from "@server/payments/payment.service";

/**
 * Hourly, which is the schedule floor.
 *
 * This ran every fifteen minutes when it was written, then became daily because the host's free
 * plan refuses a deployment whose cron fires more than once a day — a property of where the
 * schedule lived rather than of the work
 * ([ADR-0037](../../docs/adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)).
 * Moving it here lifts that limit and meets a different one: a tick is a query, and the idle
 * worker's modelled day already sits at 1441 operations against a declared ceiling of 1500
 * ([ADR-0038](../../docs/adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)
 * D8). Even a half-hourly floor would model past it, so fifteen minutes is not available without
 * raising that ceiling, which is a decision rather than a constant.
 *
 * An hour is twenty-four times the old interval and bounds a stuck checkout at roughly seventy
 * minutes instead of a day. That is the trade, and it is recorded here so the next person reads
 * a reason rather than a number.
 */
export const PAYMENT_RECONCILE_INTERVAL_SECONDS = JOBS_SCHEDULE_MIN_INTERVAL_SECONDS;

/**
 * The backstop for a payment we were never told about (payment-confirmation R6).
 *
 * Every pending order past the fifteen-minute hold window is put to the gateway: captured means the webhook was
 * lost and the order is confirmed through the same routine every other trigger uses, in flight
 * means the money is still moving and the goods stay held, and anything else releases the stock.
 * A plain call into the domain, with no HTTP between the queue and the code
 * ([ADR-0038](../../docs/adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md) D3).
 *
 * Every run reports, including the quiet ones. The handler this replaced logged only when it had
 * recovered something, so a run that found nothing and a run that never happened looked exactly
 * alike — which is no way to watch a backstop.
 */
export const paymentReconcileJob = registerJob({
  type: "payment.reconcile",
  schema: z.object({}),
  handler: async ({ jobId }) => {
    const results = await paymentService.reconcileStuckOrders();
    const count = (outcome: string) => results.filter((result) => result.outcome === outcome).length;

    console.log(
      `[jobs] payment.reconcile ${jobId}: examined ${results.length}, ` +
        `confirmed ${count("confirmed")}, released ${count("released")}, ` +
        `still in flight ${count("in-flight")}, errors ${count("error")}`,
    );
  },
});

registerSchedule(paymentReconcileJob, {}, PAYMENT_RECONCILE_INTERVAL_SECONDS);
