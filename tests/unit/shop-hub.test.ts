/**
 * The Shop tab's rows fail alone (own-store onboarding D3, ux.md Shop hub "Retryable error"): one
 * source throwing must cost its own row, never the page or the other rows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const listLocations = vi.fn();
const ratingForOrg = vi.fn();
const brandPageForStanding = vi.fn();

vi.mock("@server/catalog/shop-details.service", () => ({ shopDetailsService: { get: (id: string) => get(id) } }));
vi.mock("@server/catalog/org.address.service", () => ({ orgAddressService: { listLocations: (id: string) => listLocations(id) } }));
vi.mock("@server/catalog/review.service", () => ({ reviewService: { ratingForOrg: (id: string) => ratingForOrg(id) } }));
const getByHandle = vi.fn();
vi.mock("@/data-access-layer/storefront.dal", () => ({
  storefrontDAL: {
    brandPageForStanding: (h: string, r: unknown) => brandPageForStanding(h, r),
    getByHandle: (h: string) => getByHandle(h),
  },
}));

const { shopHubDAL } = await import("@/data-access-layer/org/shop-hub.dal");

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.NEXT_PUBLIC_APP_URL = "https://bb.test";
  get.mockReset().mockResolvedValue({ handle: "abc-traders", name: "ABC Traders", logoUrl: null, tagline: "Attar since 1920" });
  listLocations.mockReset().mockResolvedValue([{ isActive: true }, { isActive: false }]);
  ratingForOrg.mockReset().mockResolvedValue({ average: 4.5, count: 3 });
  brandPageForStanding.mockReset().mockResolvedValue(null);
  getByHandle.mockReset().mockResolvedValue(null);
});

describe("shopHubDAL", () => {
  it("keeps every other row when the reviews read throws", async () => {
    ratingForOrg.mockRejectedValue(new Error("db down"));
    const hub = await shopHubDAL.forOrg("o1");
    expect(hub.reviews).toEqual({ ok: false });
    expect(hub.addresses).toEqual({ ok: true, value: { active: 1, total: 2 } });
    expect(hub.details).toEqual({ ok: true, value: { hasLogo: false, hasTagline: true } });
    expect(hub.share).toMatchObject({ path: "/store/abc-traders", url: "https://bb.test/store/abc-traders" });
  });

  it("keeps the address and review rows when the shop's details cannot be read", async () => {
    get.mockRejectedValue(new Error("db down"));
    const hub = await shopHubDAL.forOrg("o1");
    expect(hub.details).toEqual({ ok: false });
    expect(hub.share).toBeNull();
    expect(hub.addresses.ok && hub.reviews.ok).toBe(true);
  });

  it("keeps the share link when the public read fails, previewing from the shop's own details (D13)", async () => {
    getByHandle.mockRejectedValue(new Error("db down"));
    const hub = await shopHubDAL.forOrg("o1");
    expect(hub.share?.url).toBe("https://bb.test/store/abc-traders");
    expect(hub.share?.preview).toEqual({ title: "ABC Traders", description: "Attar since 1920", image: null });
  });

  it("counts only active pickup addresses, so a switched-off one does not read as set up", async () => {
    listLocations.mockResolvedValue([{ isActive: false }]);
    expect((await shopHubDAL.forOrg("o1")).addresses).toEqual({ ok: true, value: { active: 0, total: 1 } });
  });

  it("reads the rating once for both the page and reviews rows", async () => {
    await shopHubDAL.forOrg("o1");
    expect(ratingForOrg).toHaveBeenCalledTimes(1);
    expect(brandPageForStanding).toHaveBeenCalledWith("abc-traders", { average: 4.5, count: 3 });
  });

  it("keeps the page row when the rating read throws, treating it as no reviews yet", async () => {
    ratingForOrg.mockRejectedValue(new Error("db down"));
    const hub = await shopHubDAL.forOrg("o1");
    expect(hub.page.ok).toBe(true);
    expect(brandPageForStanding).toHaveBeenCalledWith("abc-traders", { average: null, count: 0 });
  });
});
