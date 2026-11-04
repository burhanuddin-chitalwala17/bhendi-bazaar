import { cache } from "react";
import { salesOverview } from "@server/analytics/sales.service";
import { adminAttention } from "@server/analytics/attention.service";
import type { SalesOverview, SalesPeriod } from "@server/analytics/sales.types";
import type { AdminAttention } from "@server/analytics/attention.types";

/** One block's read: a failure costs that block and its own retry, never the page (the Home pattern, D7). */
export type DashboardRead<T> = { ok: true; value: T } | { ok: false };

export interface AdminDashboardData {
  sales: DashboardRead<SalesOverview>;
  attention: DashboardRead<AdminAttention>;
  readAt: string;
}

async function settle<T>(label: string, read: () => Promise<T>): Promise<DashboardRead<T>> {
  try {
    return { ok: true, value: await read() };
  } catch (error) {
    console.error(`[Admin dashboard] ${label} read failed:`, error);
    return { ok: false };
  }
}

/**
 * The admin dashboard's figures and queue, read live (Q30, Q31): three statements a load — the
 * day series, the supporting figures, the attention queue. Never through `cachedRead`: money is
 * never read from the storefront cache (ADR-0065).
 */
export const adminDashboardDAL = {
  forPeriod: cache(async (period: SalesPeriod): Promise<AdminDashboardData> => {
    const now = new Date();
    const [sales, attention] = await Promise.all([
      settle("sales", () => salesOverview(period, now)),
      settle("attention", () => adminAttention(now)),
    ]);
    return { sales, attention, readAt: now.toISOString() };
  }),
};
