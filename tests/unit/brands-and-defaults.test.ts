// An org's private listing context (docs/specs/seller-profile/, PR 2): the two brand envelopes,
// the defaults schema that never demands anything, the percent/basis-point and list/map
// conversions, and the services' answers when the database says duplicate or not-found.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import type { Brand } from "@prisma/client";

vi.mock("@server/catalog/brand.repository", () => ({
  brandRepository: {
    listForOrg: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    retire: vi.fn(),
    markDefault: vi.fn(),
  },
}));
vi.mock("@server/listing/org-listing-defaults.repository", () => ({
  orgListingDefaultsRepository: { findByOrgId: vi.fn(), upsert: vi.fn() },
}));

import { brandSchema, updateBrandSchema } from "@/lib/validation/schemas/brand.schema";
import { listingDefaultsSchema } from "@/lib/validation/schemas/listing-defaults.schema";
import {
  EMPTY_LISTING_DEFAULTS,
  bpsToPercent,
  percentToBps,
  taxCodesFromColumn,
  taxCodesToColumn,
  toListingDefaultsDto,
} from "@server/listing/org-listing-defaults.types";
import { brandRepository } from "@server/catalog/brand.repository";
import { brandService } from "@server/catalog/brand.service";
import { orgListingDefaultsRepository } from "@server/listing/org-listing-defaults.repository";
import { orgListingDefaultsService } from "@server/listing/org-listing-defaults.service";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";

const row = (overrides: Partial<Brand> = {}): Brand => ({
  id: "b1",
  orgId: "org-1",
  name: "Zed",
  manufacturer: null,
  packerOrImporter: null,
  countryOfOrigin: null,
  isDefault: false,
  retiredAt: null,
  createdAt: new Date("2026-09-27T00:00:00Z"),
  updatedAt: new Date("2026-09-27T00:00:00Z"),
  ...overrides,
});

/** What `@prisma/adapter-pg` raises for a duplicate `(orgId, name)`. */
const duplicateName = {
  code: "P2002",
  meta: { driverAdapterError: { cause: { constraint: { fields: ["orgId", "name"] } } } },
};

describe("brandSchema — create", () => {
  it("needs only a name; blanks become null and isDefault defaults off (R5)", () => {
    expect(brandSchema.parse({ name: "  Zed  ", manufacturer: "", countryOfOrigin: "  " })).toEqual({
      name: "Zed",
      manufacturer: null,
      packerOrImporter: null,
      countryOfOrigin: null,
      isDefault: false,
    });
  });

  it("refuses a blank name", () => {
    expect(() => brandSchema.parse({ name: "  " })).toThrow(ZodError);
  });
});

describe("updateBrandSchema — PATCH", () => {
  it("leaves an unmentioned field unmentioned, so a PATCH cannot clear what it did not send", () => {
    expect(updateBrandSchema.parse({ name: "Zed" })).toEqual({ name: "Zed" });
  });

  it("still turns a sent blank into null — that is how a field is cleared", () => {
    expect(updateBrandSchema.parse({ manufacturer: "" })).toEqual({ manufacturer: null });
  });
});

describe("listingDefaultsSchema", () => {
  it("accepts everything blank: a NaN percent from an empty input is absent, codes default to none", () => {
    expect(listingDefaultsSchema.parse({ countryOfOrigin: "", taxRatePercent: Number.NaN })).toEqual({
      countryOfOrigin: null,
      taxRatePercent: undefined,
      taxCodes: [],
    });
  });

  it("bounds the rate to a percentage", () => {
    expect(() => listingDefaultsSchema.parse({ taxRatePercent: 101 })).toThrow(ZodError);
    expect(() => listingDefaultsSchema.parse({ taxRatePercent: -1 })).toThrow(ZodError);
  });
});

describe("percent and basis points", () => {
  it("round to whole basis points and back", () => {
    expect(percentToBps(18)).toBe(1800);
    expect(percentToBps(0.5)).toBe(50);
    expect(percentToBps(18.005)).toBe(1801);
    expect(bpsToPercent(1800)).toBe(18);
    expect(bpsToPercent(percentToBps(12.5))).toBe(12.5);
  });
});

describe("the tax-code map", () => {
  it("reads only string values out of an object, and nothing out of anything else", () => {
    expect(taxCodesFromColumn(null)).toEqual([]);
    expect(taxCodesFromColumn([1, 2])).toEqual([]);
    expect(taxCodesFromColumn({ a: "1234", b: 3, c: "  " })).toEqual([{ categoryId: "a", taxCode: "1234" }]);
  });

  it("drops blank codes on the way in, so clearing a field is the same as never filling it", () => {
    expect(
      taxCodesToColumn([
        { categoryId: "a", taxCode: "1234" },
        { categoryId: "b", taxCode: "" },
        { categoryId: "c", taxCode: " 99 " },
      ]),
    ).toEqual({ a: "1234", c: "99" });
  });

  it("an org with nothing saved reads as empty, not as an error", () => {
    expect(toListingDefaultsDto(null)).toBe(EMPTY_LISTING_DEFAULTS);
  });
});

describe("brandService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("turns the database's duplicate (orgId, name) into a conflict the org can read", async () => {
    vi.mocked(brandRepository.create).mockRejectedValue(duplicateName);
    await expect(
      brandService.create("org-1", { name: "Zed", manufacturer: null, packerOrImporter: null, countryOfOrigin: null, isDefault: false }),
    ).rejects.toMatchObject({ name: "ConflictError", message: expect.stringContaining('"Zed"') });
  });

  it("rethrows anything that is not a uniqueness failure", async () => {
    vi.mocked(brandRepository.create).mockRejectedValue(new Error("connection reset"));
    await expect(
      brandService.create("org-1", { name: "Zed", manufacturer: null, packerOrImporter: null, countryOfOrigin: null, isDefault: false }),
    ).rejects.not.toBeInstanceOf(ConflictError);
  });

  it("a brand created as the default is marked so, clearing any other", async () => {
    vi.mocked(brandRepository.create).mockResolvedValue(row({ isDefault: true }));
    const dto = await brandService.create("org-1", { name: "Zed", manufacturer: null, packerOrImporter: null, countryOfOrigin: null, isDefault: true });
    expect(brandRepository.markDefault).toHaveBeenCalledWith("org-1", "b1");
    expect(dto.isDefault).toBe(true);
  });

  it("an update or retire that touches no row is not found — which is also how another org's id reads", async () => {
    vi.mocked(brandRepository.update).mockResolvedValue(false);
    vi.mocked(brandRepository.retire).mockResolvedValue(false);
    await expect(brandService.update("org-2", "b1", { name: "X" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(brandService.retire("org-2", "b1")).rejects.toBeInstanceOf(NotFoundError);
    expect(brandRepository.markDefault).not.toHaveBeenCalled();
  });

  it("puts a retired brand on the wire with an ISO timestamp", async () => {
    vi.mocked(brandRepository.listForOrg).mockResolvedValue([row({ retiredAt: new Date("2026-09-27T10:00:00Z") })]);
    const [dto] = await brandService.list("org-1");
    expect(dto).toMatchObject({ id: "b1", name: "Zed", retiredAt: "2026-09-27T10:00:00.000Z" });
    expect(dto).not.toHaveProperty("orgId");
  });
});

describe("orgListingDefaultsService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("stores the percent as basis points and the list as a map with blanks dropped", async () => {
    vi.mocked(orgListingDefaultsRepository.upsert).mockResolvedValue({
      orgId: "org-1",
      countryOfOrigin: "India",
      taxRateBps: 1800,
      taxCodeByCategory: { cat: "1234" },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const dto = await orgListingDefaultsService.save("org-1", {
      countryOfOrigin: "India",
      taxRatePercent: 18,
      taxCodes: [{ categoryId: "cat", taxCode: "1234" }, { categoryId: "other", taxCode: "" }],
    });
    expect(orgListingDefaultsRepository.upsert).toHaveBeenCalledWith("org-1", {
      countryOfOrigin: "India",
      taxRateBps: 1800,
      taxCodeByCategory: { cat: "1234" },
    });
    expect(dto).toEqual({ countryOfOrigin: "India", taxRatePercent: 18, taxCodes: [{ categoryId: "cat", taxCode: "1234" }] });
  });

  it("an absent percent is stored as no rate, never as zero", async () => {
    vi.mocked(orgListingDefaultsRepository.upsert).mockResolvedValue({
      orgId: "org-1", countryOfOrigin: null, taxRateBps: null, taxCodeByCategory: {}, createdAt: new Date(), updatedAt: new Date(),
    });
    await orgListingDefaultsService.save("org-1", { countryOfOrigin: null, taxRatePercent: undefined, taxCodes: [] });
    expect(orgListingDefaultsRepository.upsert).toHaveBeenCalledWith("org-1", { countryOfOrigin: null, taxRateBps: null, taxCodeByCategory: {} });
  });
});
