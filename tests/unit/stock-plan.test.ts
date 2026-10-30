// What a marketplace listing should show (inventory-sync D3): matched, not used, archived, waiting.
import { describe, expect, it } from "vitest";

import { countsFor, lastSent, sameCounts } from "@server/channels/stock-plan";

const loc = (externalId: string, orgAddressId: string | null, extra: { notUsed?: boolean; goneAt?: Date | null } = {}) => ({
  externalId,
  orgAddressId,
  notUsed: extra.notUsed ?? false,
  goneAt: extra.goneAt ?? null,
});
const product = { archived: false, stock: [{ orgAddressId: "mumbai", quantity: 5 }, { orgAddressId: "bhiwandi", quantity: 2 }] };

describe("the counts a listing should show (Q3, Q6, Q16)", () => {
  it("sends each marketplace location its matched location's own count, and 0 where we hold none", () => {
    expect(countsFor([loc("FK-1", "mumbai"), loc("FK-2", "bhiwandi"), loc("FK-3", "pune")], product)).toEqual([
      { externalId: "FK-1", quantity: 5 },
      { externalId: "FK-2", quantity: 2 },
      { externalId: "FK-3", quantity: 0 },
    ]);
  });

  it("sends 0 to a location marked not used, and to every location of an archived product", () => {
    expect(countsFor([loc("FK-1", "mumbai"), loc("FK-2", null, { notUsed: true })], product)).toEqual([
      { externalId: "FK-1", quantity: 5 },
      { externalId: "FK-2", quantity: 0 },
    ]);
    expect(countsFor([loc("DEFAULT", "mumbai")], { ...product, archived: true })).toEqual([{ externalId: "DEFAULT", quantity: 0 }]);
  });

  it("sends nothing while a live location is unmatched, and ignores one that is gone", () => {
    expect(countsFor([loc("FK-1", "mumbai"), loc("FK-2", null)], product)).toBeNull();
    expect(countsFor([loc("FK-1", "mumbai"), loc("FK-2", null, { goneAt: new Date() })], product)).toEqual([{ externalId: "FK-1", quantity: 5 }]);
  });

  it("skips a send of the counts already sent, and knows a listing the marketplace stocks itself", () => {
    const sent = lastSent({ counts: [{ externalId: "FK-1", quantity: 5 }] });
    expect(sameCounts(sent.counts, [{ externalId: "FK-1", quantity: 5 }])).toBe(true);
    expect(sameCounts(sent.counts, [{ externalId: "FK-1", quantity: 4 }])).toBe(false);
    expect(sameCounts(null, [{ externalId: "FK-1", quantity: 5 }])).toBe(false);
    expect(lastSent({ heldByMarketplace: true }).held).toBe(true);
  });
});
