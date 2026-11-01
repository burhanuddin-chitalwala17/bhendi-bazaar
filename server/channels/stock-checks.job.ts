import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

const noPayload = z.object({});
type NoPayload = z.infer<typeof noPayload>;

/**
 * The order check, a safety net for sales made on a marketplace (inventory-sync D4, Q23, Q26): every
 * ten minutes while a connection has stock sync on, each run enqueueing the next. A change made on
 * Bhendi Bazaar does not wait for it: its stock command pushes at once (Q19). Turning sync on starts
 * it; the daily maintain pass restarts it. The handlers are in channels.jobs.ts, which only the worker imports.
 */
export const checkOrdersSpec: JobSpec<NoPayload> = { type: "channels.check-orders", schema: noPayload };

/** Ten minutes (Q26, which supersedes parent Q30's five); one checked within the last eight is not checked again. */
export const ORDERS_CHECK_EVERY_SECONDS = 600;
export const ORDERS_CHECK_GAP_MS = 480_000;

/** The daily check (D5), enqueued by the daily maintain pass rather than a schedule of its own. */
export const checkStockSpec: JobSpec<NoPayload> = { type: "channels.check-stock", schema: noPayload };
