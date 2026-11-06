/**
 * "Raise a request" (setup-requests Q36): one tap on a listing raises every ticket it needs, from what
 * the server sees, never a list the browser sends; and a raised ticket says when, what, and where to
 * follow it instead of a bare "With us".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { render, screen } from "@testing-library/react";

const complaint = vi.hoisted(() => vi.fn());
const raiseFromEvents = vi.hoisted(() => vi.fn(async () => 1));
// The org guard is withOrg's own test; here the handler runs as the member of org_1.
vi.mock("@/lib/org-auth", () => ({
  withOrg:
    <P extends { orgId: string }>(handler: (r: NextRequest, scope: { orgId: string }, p: P) => Promise<Response>) =>
    async (r: NextRequest, ctx: { params: Promise<P> }) => {
      const p = await ctx.params;
      return handler(r, { orgId: p.orgId }, p);
    },
}));
vi.mock("@server/channels/platform-listing.service", () => ({ platformListingService: { complaint } }));
vi.mock("@server/requests/request.service", () => ({ requestService: { raiseFromEvents } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { POST } from "@/app/api/org/[orgId]/channels/[channel]/listings/[id]/request/route";
import { ListingFixes } from "@/components/channel/listing-fixes";
import { LISTING_FIX, type ListingScreenDTO } from "@server/channels/platform-listing.types";
import { SHOP_STATE, TICKET_TYPE, type ShopTicketDTO } from "@server/requests/request.types";
import { MARKETPLACE_KIND } from "@server/requests/marketplace/marketplace.types";
import { REQUESTS_COPY } from "@/components/requests/requests-copy";

const params = { orgId: "org_1", channel: "amazon", id: "p1" };
const call = (body?: unknown) =>
  POST(new NextRequest("https://x.test/api/org/org_1/channels/amazon/listings/p1/request", { method: "POST", body: body ? JSON.stringify(body) : undefined }), { params: Promise.resolve(params) });

describe("the raise route (Q36)", () => {
  beforeEach(() => {
    complaint.mockReset();
    raiseFromEvents.mockClear();
  });

  it("raises what the server reads on the listing, whatever the browser sends", async () => {
    const seen = { orgId: "org_1", productId: "p1", channel: "amazon", productType: null, kind: null, theirCategory: "HANDBAG", issues: [] };
    complaint.mockResolvedValue(seen);
    const response = await call({ attributes: ["anything_at_all"], orgId: "someone_else" });
    expect(complaint).toHaveBeenCalledWith("org_1", "p1", "amazon");
    expect(raiseFromEvents).toHaveBeenCalledWith([seen]);
    expect(await response.json()).toEqual({ ok: true, raised: 1 });
  });

  it("raises nothing, and says so, when the listing has no error", async () => {
    complaint.mockResolvedValue(null);
    const response = await call();
    expect(raiseFromEvents).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ ok: true, raised: 0 });
  });
});

const listing = (over: Partial<ListingScreenDTO> = {}) =>
  ({
    channel: "amazon",
    label: "Amazon",
    productId: "p1",
    productName: "Cloth bag",
    locked: { mrpPaise: 100, barcode: null, brand: null, stock: 1 },
    draft: null,
    fixes: [{ kind: LISTING_FIX.ADMIN, names: ["Strap Type", "Style"] }],
    ...over,
  }) as ListingScreenDTO;

const ticket = (over: Partial<ShopTicketDTO> = {}): ShopTicketDTO => ({
  id: "t1",
  type: TICKET_TYPE.REQUIREMENT,
  kind: MARKETPLACE_KIND.FIELDS,
  state: SHOP_STATE.WITH_US,
  title: "Amazon details for Handbag",
  category: null,
  names: ["Strap Type", "Style"],
  productId: "p1",
  raisedAt: "2026-11-05T10:00:00.000Z",
  ...over,
});

describe("the listing's How to fix it line (Q36)", () => {
  it("offers Raise a request, not a WhatsApp message, before a ticket exists", () => {
    render(<ListingFixes orgId="org_1" screen={listing()} tickets={[]} />);
    expect(screen.getByRole("button", { name: REQUESTS_COPY.raiseRequest })).toBeTruthy();
    expect(screen.queryByText(/Ask the admin/i)).toBeNull();
  });

  it("says when it was raised, what it covers, and links to the shop's requests", () => {
    render(<ListingFixes orgId="org_1" screen={listing()} tickets={[ticket()]} />);
    expect(screen.getByText(REQUESTS_COPY.shopState[SHOP_STATE.WITH_US])).toBeTruthy();
    expect(screen.getByText(/Request raised/)).toBeTruthy();
    expect(screen.getByText(/Covers: Strap Type, Style/)).toBeTruthy();
    expect(screen.getByRole("link", { name: REQUESTS_COPY.viewRequests }).getAttribute("href")).toBe("/org/org_1/requests");
    expect(screen.queryByRole("button", { name: REQUESTS_COPY.raiseRequest })).toBeNull();
  });
});
