// @vitest-environment node
// checkout-links D2, D3 at the two edges: the open request keys its once-only claim by account or
// device, and the link page sends an edited or expired link where ux.md says.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
const open = vi.hoisted(() => vi.fn());
const resolve = vi.hoisted(() => vi.fn());

vi.mock("@server/shared/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/admin-auth", () => ({ optionalActiveSession: async () => session.current }));
vi.mock("@/lib/rate-limit", () => ({ limitRequest: async () => null }));
vi.mock("@server/cart/checkout-link.service", () => ({ checkoutLinkService: { open, resolve } }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

import { POST } from "@/app/api/checkout-links/open/route";
import CheckoutLinkPage from "@/app/(main)/c/[shop]/[token]/page";
import { CheckoutLinkOpener } from "@/components/cart/checkout-link/CheckoutLinkOpener";
import { CheckoutLinkSizeStep } from "@/components/cart/checkout-link/CheckoutLinkSizeStep";

const DEVICE = "3f2c1b9a-0d4e-4c3b-9a8f-1e2d3c4b5a69";
const TOKEN = "A".repeat(22);

function request(cookie?: string, extra: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/checkout-links/open", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ shop: "niqab", token: TOKEN, ...extra }),
  });
}

describe("POST /api/checkout-links/open — whose cart a link is claimed for", () => {
  beforeEach(() => {
    session.current = null;
    open.mockReset().mockResolvedValue({ kind: "unknown" });
  });

  it("a signed-in buyer claims it for the account (spec A3)", async () => {
    session.current = { user: { id: "u1" } };
    await POST(request(`bb_device=${DEVICE}`));
    expect(open).toHaveBeenCalledWith("niqab", TOKEN, "user:u1", expect.any(Date), []);
  });

  it("a guest reuses the device cookie and is not given a new one (spec A3)", async () => {
    const response = await POST(request(`bb_device=${DEVICE}`));
    expect(open).toHaveBeenCalledWith("niqab", TOKEN, `device:${DEVICE}`, expect.any(Date), []);
    expect(response.cookies.get("bb_device")).toBeUndefined();
  });

  it("a guest without a valid device cookie gets a new one, httpOnly", async () => {
    const response = await POST(request("bb_device=not-a-uuid"));
    const set = response.cookies.get("bb_device");
    expect(set?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(set?.httpOnly).toBe(true);
    expect(open).toHaveBeenCalledWith("niqab", TOKEN, `device:${set?.value}`, expect.any(Date), []);
  });

  it("passes the sizes picked on the size step, and nothing else (D6)", async () => {
    await POST(request(`bb_device=${DEVICE}`, { sizes: ["m1"], price: 1 }));
    expect(open).toHaveBeenCalledWith("niqab", TOKEN, `device:${DEVICE}`, expect.any(Date), ["m1"]);
  });
});

describe("the link page — where an edited or expired link goes (spec A4)", () => {
  const page = (shop: string, size?: string | string[]) =>
    CheckoutLinkPage({ params: Promise.resolve({ shop, token: TOKEN }), searchParams: Promise.resolve({ size }) });

  it("an edited link opens the shop's page", async () => {
    resolve.mockResolvedValue({ kind: "unknown" });
    await expect(page("niqab")).rejects.toThrow("REDIRECT /store/niqab");
  });

  it("an expired link opens its product with the expired line", async () => {
    resolve.mockResolvedValue({ kind: "expired", productSlug: "green-kurta" });
    await expect(page("niqab")).rejects.toThrow("REDIRECT /product/green-kurta?link=expired");
  });

  it("an expired link whose products are gone opens the shop's page", async () => {
    resolve.mockResolvedValue({ kind: "expired", productSlug: null });
    await expect(page("niqab")).rejects.toThrow("REDIRECT /store/niqab");
  });

  it("a live link renders the opener and redirects nowhere", async () => {
    resolve.mockResolvedValue({ kind: "live", linkId: "l1", sizeSteps: [] });
    const rendered = await page("niqab");
    expect(rendered.type).toBe(CheckoutLinkOpener);
    expect(rendered.props).toMatchObject({ shop: "niqab", token: TOKEN, sizes: [] });
  });
});

describe("the link page — the size step (D6, ux.md journey 6)", () => {
  const step = { productId: "m", options: [{ productId: "m", name: "Kurta M", thumbnail: "/m.webp" }, { productId: "l", name: "Kurta L", thumbnail: "/l.webp" }] };
  const page = (size?: string | string[]) =>
    CheckoutLinkPage({ params: Promise.resolve({ shop: "niqab", token: TOKEN }), searchParams: Promise.resolve({ size }) });

  it("a size still to pick shows the step before anything is added", async () => {
    resolve.mockResolvedValue({ kind: "live", linkId: "l1", sizeSteps: [step] });
    const rendered = await page();
    expect(rendered.type).toBe(CheckoutLinkSizeStep);
    expect(rendered.props).toMatchObject({ step, picked: [] });
  });

  it("a size picked opens the link with it", async () => {
    resolve.mockResolvedValue({ kind: "live", linkId: "l1", sizeSteps: [step] });
    const rendered = await page("l");
    expect(rendered.type).toBe(CheckoutLinkOpener);
    expect(rendered.props).toMatchObject({ sizes: ["l"] });
  });

  it("a pick that is not one of the sizes still asks", async () => {
    resolve.mockResolvedValue({ kind: "live", linkId: "l1", sizeSteps: [step] });
    expect((await page("x")).type).toBe(CheckoutLinkSizeStep);
  });
});
