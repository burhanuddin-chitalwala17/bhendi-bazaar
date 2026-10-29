import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

const noPayload = z.object({});
type NoPayload = z.infer<typeof noPayload>;

/**
 * The order check (inventory-sync D4, Q23): it runs every five minutes only while a connection has
 * stock sync on, each run enqueueing the next. Turning sync on starts it; the daily maintain pass
 * restarts it if it stopped. The handlers are in channels.jobs.ts, which only the worker imports.
 */
export const checkOrdersSpec: JobSpec<NoPayload> = { type: "channels.check-orders", schema: noPayload };

/** Five minutes (parent Q30); a connection checked within the last four is not checked again. */
export const ORDERS_CHECK_EVERY_SECONDS = 300;
export const ORDERS_CHECK_GAP_MS = 240_000;

/** The daily check (D5), enqueued by the daily maintain pass rather than a schedule of its own. */
export const checkStockSpec: JobSpec<NoPayload> = { type: "channels.check-stock", schema: noPayload };
