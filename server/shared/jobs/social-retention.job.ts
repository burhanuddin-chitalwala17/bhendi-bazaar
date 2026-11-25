import { z } from "zod";
import type { JobSpec } from "./jobs.types";

const noPayload = z.object({});
type NoPayload = z.infer<typeof noPayload>;

/**
 * The daily deletion of social-selling's aged rows (social-selling D15): today the hub's events and
 * deliveries after 13 months (notifications-core D7, Q7). Queued by `channels.maintain` beside Meta's
 * own retention, so channels never imports notifications; the handler is notifications'.
 */
export const socialRetentionSpec: JobSpec<NoPayload> = { type: "social.retention", schema: noPayload };
