import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

const noPayload = z.object({});
type NoPayload = z.infer<typeof noPayload>;

/** Queued by `channels.maintain` once a day (no schedule slot is free); handlers in channels.jobs.ts. */
export const metaRetentionSpec: JobSpec<NoPayload> = { type: "channels.meta-retention", schema: noPayload };
export const metaSweepSpec: JobSpec<NoPayload> = { type: "channels.meta-sweep", schema: noPayload };
