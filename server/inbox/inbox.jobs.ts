/** The inbox's worker registrations: its sinks, its send job, its timed work and its forgetter (inbox-core D2, D5, D6, D10). Only the worker imports this file. */
import "./inbox.sinks";
import { registerJob } from "@server/shared/jobs/jobs.registry";
import { prisma } from "@server/shared/prisma";
import { registerForgetter } from "@server/shared/social-events/forget";
import { inboxSendSpec } from "./inbox-send.job";
import { inboxSendService } from "./inbox-send.service";
import { RETENTION_EVERY_SECONDS, retentionDaily, retentionSpec, waitingSweepSpec } from "./inbox-care.job";
import { inboxRetention } from "./inbox-retention.service";
import { inboxWaiting } from "./inbox-waiting.service";

/** Tells the hub of every thread waiting four hours, once a spell (D5, A6). */
export const waitingSweepJob = registerJob({
  ...waitingSweepSpec,
  handler: async ({ jobId }) => {
    console.log(`[jobs] inbox.waiting ${jobId}: ${JSON.stringify(await inboxWaiting.sweep())}`);
  },
});

/** Threads of an account the shop left 90 days ago, deleted in batches; then tomorrow's run (D10). */
export const retentionJob = registerJob({
  ...retentionSpec,
  handler: async ({ jobId }) => {
    console.log(`[jobs] inbox.retention ${jobId}: ${JSON.stringify(await inboxRetention.run())}`);
    await retentionDaily(prisma, RETENTION_EVERY_SECONDS);
  },
});

registerForgetter({ name: "inbox", forget: (platform, platformUserId) => inboxRetention.forgetPerson(platform, platformUserId) });

/** One outbound message's next step: released at the hold's end, claimed, sent (D6). */
export const inboxSendJob = registerJob({
  ...inboxSendSpec,
  handler: async ({ payload }) => {
    await inboxSendService.deliver(payload.orgId, payload.messageId);
  },
});
