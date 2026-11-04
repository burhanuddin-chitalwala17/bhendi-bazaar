/**
 * The admin dashboard's display shaping (design-system Q13, Q30, Q31): the hand-drawn chart, the
 * "Needs action" lines and the period in the URL. The failure modes: a quiet week drawing NaN
 * (a blank chart that looks like a bug), "1 buyers" or raw paise in a line, and a typed URL
 * choosing a period the server does not offer.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { linePoints, SalesChart } from "@/components/dashboard/sales-chart";
import { attentionCopy } from "@/components/dashboard/attention-copy";
import { parsePeriod } from "@/components/dashboard/period";
import { ADMIN_ATTENTION, type AdminAttentionItem } from "@server/analytics/attention.types";
import { SALES_PERIOD, type SalesDay } from "@server/analytics/sales.types";

const days = (paise: number[]): SalesDay[] =>
  paise.map((p, i) => ({ day: `2026-11-0${i + 1}`, paise: p, orders: p > 0 ? 1 : 0 }));

describe("the sales chart", () => {
  it("draws one point per day, oldest left, on a shared scale", () => {
    const points = linePoints([100, 300, 200], 300);
    expect(points).toHaveLength(3);
    expect(points[0].x).toBeLessThan(points[2].x);
    // The peak is the highest point (smallest y); a point at the peak sits at the top margin.
    expect(points[1].y).toBeLessThan(points[0].y);
  });

  it("draws an all-zero period flat on the baseline, never NaN", () => {
    const points = linePoints([0, 0, 0, 0, 0, 0, 0], 0);
    expect(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(new Set(points.map((p) => p.y)).size).toBe(1);

    const { container } = render(
      <SalesChart series={days([0, 0, 0, 0, 0, 0, 0])} previousSeries={days([0, 0, 0, 0, 0, 0, 0])} currentLabel="Last 7 days" previousLabel="The 7 days before" />,
    );
    const svg = container.querySelector("svg[role=img]");
    expect(svg?.getAttribute("aria-label")).toMatch(/No sales/);
    for (const path of container.querySelectorAll("path")) expect(path.getAttribute("d")).not.toMatch(/NaN/);
  });

  it("says in words what the picture shows", () => {
    const { container } = render(
      <SalesChart series={days([10_000, 50_000, 0])} previousSeries={days([5_000, 5_000, 5_000])} currentLabel="Last 3 days" previousLabel="The 3 days before" />,
    );
    const label = container.querySelector("svg[role=img]")?.getAttribute("aria-label") ?? "";
    expect(label).toContain("₹600");
    expect(label).toContain("highest ₹500");
    expect(label).toContain("₹150");
  });
});

describe("the needs-action lines", () => {
  const now = new Date("2026-11-04T10:00:00Z");
  const item = (over: Partial<AdminAttentionItem>): AdminAttentionItem => ({
    key: ADMIN_ATTENTION.REFUNDS,
    count: 1,
    waiting: null,
    oldestAt: null,
    href: "/admin/orders/refunds",
    ...over,
  });

  it("pluralises by count and gives the oldest's age", () => {
    const one = attentionCopy(item({ count: 1, waiting: { buyers: 1, amountPaise: 45_000 } }), now);
    expect(one.title).toBe("1 buyer waiting for refunds");
    const many = attentionCopy(
      item({ count: 3, waiting: { buyers: 3, amountPaise: 45_000 }, oldestAt: "2026-11-02T09:00:00Z" }),
      now,
    );
    expect(many.title).toBe("3 buyers waiting for refunds");
    expect(many.detail).toBe("3 refunds · ₹450 to return · oldest 2 days");
  });

  it("formats what is owed from paise, in Indian grouping", () => {
    const line = attentionCopy(item({ key: ADMIN_ATTENTION.PAYOUTS, count: 19, waiting: { amountPaise: 31_240_000 } }), now);
    expect(line.title).toBe("₹3,12,400 owed to 19 shops");
  });

  it("names the courier conflicts and the parcels to book", () => {
    expect(attentionCopy(item({ key: ADMIN_ATTENTION.COURIER_CONFLICTS, count: 1 }), now).title).toBe("1 courier update we couldn't apply");
    expect(attentionCopy(item({ key: ADMIN_ATTENTION.PARCELS_TO_BOOK, count: 2 }), now).title).toBe("2 parcels packed and waiting for a pickup");
  });
});

describe("the period in the URL", () => {
  it("takes only a period the dashboard offers, and a week otherwise", () => {
    expect(parsePeriod("30d")).toBe(SALES_PERIOD.MONTH);
    expect(parsePeriod(["today", "7d"])).toBe(SALES_PERIOD.TODAY);
    expect(parsePeriod("365d")).toBe(SALES_PERIOD.WEEK);
    expect(parsePeriod("constructor")).toBe(SALES_PERIOD.WEEK);
    expect(parsePeriod(undefined)).toBe(SALES_PERIOD.WEEK);
  });
});
