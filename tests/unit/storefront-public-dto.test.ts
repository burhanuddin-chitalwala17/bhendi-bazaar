/**
 * A buyer learns an organisation's public face and nothing else (seller-identity R5,
 * seller-profile R2/A3). The storefront reads `OrgProfile` and takes only identity from
 * `Org`; these tests hold the two selects to an allowlist, so adding a column to either
 * table cannot widen a public payload without failing here. Mutation-tested by adding
 * `email: true` to the identity select.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PUBLIC_ORG_IDENTITY_SELECT,
  PUBLIC_PROFILE_SELECT,
} from "@server/catalog/org-profile.repository";

/** Everything a seller would happily print on a shop sign, and nothing they would not. */
const PUBLIC_PROFILE_FIELDS = [
  "tagline",
  "description",
  "logoUrl",
  "heroUrl",
  "accent",
  "deliveryPolicy",
  "returnsPolicy",
  "story",
  "location",
  "social",
].sort();
const PUBLIC_IDENTITY_FIELDS = ["id", "handle", "name"].sort();

/** The private face, named so a future column that joins this list is caught by intent, not by luck. */
const PRIVATE_ORG_FIELDS = [
  "email",
  "phone",
  "contactPerson",
  "businessName",
  "gstNumber",
  "panNumber",
  "isVerified",
  "commissionBps",
  "maxDiscountBps",
];

describe("the storefront's public selects", () => {
  it("select exactly the public face of the profile", () => {
    expect(Object.keys(PUBLIC_PROFILE_SELECT).sort()).toEqual(PUBLIC_PROFILE_FIELDS);
  });

  it("take only identity from the organisation", () => {
    expect(Object.keys(PUBLIC_ORG_IDENTITY_SELECT).sort()).toEqual(PUBLIC_IDENTITY_FIELDS);
    for (const field of PRIVATE_ORG_FIELDS) {
      expect(field in PUBLIC_ORG_IDENTITY_SELECT, `${field} is private face`).toBe(false);
    }
  });
});

/**
 * The about page's DTO is what it was before the columns moved (seller-profile A6): the same
 * keys, the same values, read from the profile instead of the org row.
 */
describe("storefrontDAL.getByHandle after the profile split", () => {
  const fixture = {
    tagline: "Silks since 1985",
    description: "Who we are.",
    logoUrl: "https://img.example/logo.webp",
    heroUrl: "https://img.example/hero.webp",
    accent: "primary",
    deliveryPolicy: "3 to 5 days",
    returnsPolicy: "7 days",
    story: "A longer story.",
    location: "Bhendi Bazaar, Mumbai",
    social: { instagram: "silks" },
    org: { id: "org_1", handle: "silks", name: "Silks & Co" },
  };

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@server/catalog/org-profile.repository", () => ({
      orgProfileRepository: {
        findPublicByHandle: vi.fn(async (handle: string) => (handle === "silks" ? fixture : null)),
        listPublicShops: vi.fn(async () => []),
      },
      PUBLIC_PROFILE_SELECT,
      PUBLIC_ORG_IDENTITY_SELECT,
    }));
  });

  it("returns the storefront shape unchanged", async () => {
    const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
    await expect(storefrontDAL.getByHandle("silks")).resolves.toEqual({
      id: "org_1",
      handle: "silks",
      name: "Silks & Co",
      about: "Who we are.",
      tagline: "Silks since 1985",
      logoUrl: "https://img.example/logo.webp",
      heroUrl: "https://img.example/hero.webp",
      accent: "primary",
      deliveryPolicy: "3 to 5 days",
      returnsPolicy: "7 days",
    });
  });

  it("answers null for a shop that is not there", async () => {
    const { storefrontDAL } = await import("@/data-access-layer/storefront.dal");
    await expect(storefrontDAL.getByHandle("nobody")).resolves.toBeNull();
  });
});
