import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

const noPayload = z.object({});

/**
 * The daily problems look (marketplace-publish Q23): one run for every shop, enqueued by the daily
 * maintain pass. Its handler is in channels.jobs.ts, which only the worker imports.
 */
export const checkListingProblemsSpec: JobSpec<z.infer<typeof noPayload>> = { type: "channels.check-listing-problems", schema: noPayload };
