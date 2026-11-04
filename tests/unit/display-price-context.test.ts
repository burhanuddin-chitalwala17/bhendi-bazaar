/**
 * The storefront may read offers from a cache shared across requests (ADR-0065) only because the
 * clock is applied per request: an offer cached before it started must show from its start, and one
 * cached while running must vanish at its end. That is ADR-0018's boundary, held without a query.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const offer = (id: string, startsAt: string, endsAt: string) => ({ id, startsAt: new Date(startsAt), endsAt: new Date(endsAt) });
const cached = vi.hoisted(() => ({ promotions: [] as unknown[] }));

vi.mock("@server/promotions/promotion.repository", () => ({
  promotionRepository: {
    listNotEnded: async () => cached.promotions,
    categoryParents: async () => new Map(),
  },
}));
vi.mock("@server/catalog/commercial-terms.service", () => ({ commercialTermsService: { allCeilings: async () => new Map() } }));

describe("display price context", () => {
  afterEach(() => vi.useRealTimers());

  it("applies each offer's start and end at the request's own instant", async () => {
    cached.promotions = [
      offer("running", "2026-11-04T09:00:00Z", "2026-11-04T11:00:00Z"),
      offer("upcoming", "2026-11-04T10:30:00Z", "2026-11-04T12:00:00Z"),
    ];
    const { loadDisplayPriceContext } = await import("@server/promotions/price-context");

    vi.useFakeTimers({ now: new Date("2026-11-04T10:00:00Z") });
    expect((await loadDisplayPriceContext()).promotions.map((p) => p.id)).toEqual(["running"]);

    vi.setSystemTime(new Date("2026-11-04T10:30:00Z"));
    expect((await loadDisplayPriceContext()).promotions.map((p) => p.id).sort()).toEqual(["running", "upcoming"]);

    vi.setSystemTime(new Date("2026-11-04T11:00:00Z"));
    expect((await loadDisplayPriceContext()).promotions.map((p) => p.id)).toEqual(["upcoming"]);
  });
});
