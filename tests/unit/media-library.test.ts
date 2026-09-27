/**
 * The library's read side and retirement (docs/specs/media-library/ R6, R7, A3; trd D7): the
 * filter parse that turns a query string into a scoped `where`, the DTO that derives a use count
 * rather than storing one, the refusal that names what still uses an image, and the sweep that
 * deletes a retired object only after the grace period and only when no URL still shows it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const repo = {
  listForOrg: vi.fn(),
  findForOrg: vi.fn(),
  usesOf: vi.fn(),
  retireUnused: vi.fn(),
  referencedRefs: vi.fn(),
  findStaleRetired: vi.fn(),
  clearObject: vi.fn(),
  findStalePending: vi.fn(),
  deletePending: vi.fn(),
};
const store = {
  deleteObject: vi.fn(),
  publicUrlFor: (key: string) => `https://img.test/${key}`,
  presignUpload: vi.fn(),
  headObject: vi.fn(),
  getObject: vi.fn(),
};
vi.mock("@server/catalog/media-asset.repository", () => ({ mediaAssetRepository: repo }));
vi.mock("@server/catalog/object-store", () => store);

const { mediaAssetService, RETIRED_OBJECT_GRACE_MS } = await import("@server/catalog/media-asset.service");
const { mediaLibraryFilterSchema, parseMediaLibraryFilters } = await import("@/lib/validation/schemas/media-library.schema");
const { MEDIA_LIBRARY_PAGE_SIZE, describeUses, toMediaAssetDto, totalReferences } = await import(
  "@server/catalog/media-library.types"
);

const counts = (overrides: Partial<Record<string, number>> = {}) => ({
  productMedia: 0,
  categoryHeroes: 0,
  profileLogos: 0,
  profileHeroes: 0,
  orgBanners: 0,
  banners: 0,
  derivatives: 0,
  ...overrides,
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "a1",
  kind: "IMAGE" as const,
  ref: "https://img.test/p/a.webp",
  width: 800,
  height: 600,
  bytes: 12_345,
  mimeType: "image/webp",
  source: "UPLOAD" as const,
  state: "READY" as const,
  createdAt: new Date("2026-09-27T08:00:00Z"),
  retiredAt: null,
  _count: counts(),
  ...overrides,
});

beforeEach(() => vi.resetAllMocks());

describe("mediaLibraryFilterSchema", () => {
  it("means 'any' for every blank, and defaults only the page and the usage", () => {
    expect(mediaLibraryFilterSchema.parse({ kind: "", source: "", from: "", retired: "" })).toEqual({
      usage: "all",
      retired: false,
      page: 1,
    });
  });

  it("types what a GET form sends as strings", () => {
    const parsed = parseMediaLibraryFilters(
      new URLSearchParams("kind=IMAGE&usage=used&source=DERIVED&from=2026-09-01&retired=1&page=3&slot=front"),
    );
    expect(parsed).toMatchObject({ kind: "IMAGE", usage: "used", source: "DERIVED", retired: true, page: 3, slot: "front" });
    expect(parsed.from).toEqual(new Date("2026-09-01"));
  });

  it("refuses a kind, a source or a page Prisma would not accept", () => {
    expect(() => mediaLibraryFilterSchema.parse({ kind: "GIF" })).toThrow(ZodError);
    expect(() => mediaLibraryFilterSchema.parse({ source: "SCANNED" })).toThrow(ZodError);
    expect(() => mediaLibraryFilterSchema.parse({ page: "0" })).toThrow(ZodError);
  });
});

describe("toMediaAssetDto", () => {
  it("derives the use count from the relation counts and puts dates on the wire as ISO", () => {
    const dto = toMediaAssetDto(row({ _count: counts({ productMedia: 2, orgBanners: 1 }), retiredAt: new Date("2026-09-28T00:00:00Z") }));
    expect(dto.uses).toBe(3);
    expect(dto.createdAt).toBe("2026-09-27T08:00:00.000Z");
    expect(dto.retiredAt).toBe("2026-09-28T00:00:00.000Z");
    expect(totalReferences(counts())).toBe(0);
  });
});

describe("describeUses", () => {
  const use = (kind: string, id = kind) => ({ kind, id, label: id, slot: null }) as never;

  it("names each kind with its count, plural where it counts more than one", () => {
    expect(describeUses([])).toBe("nothing");
    expect(describeUses([use("product")])).toBe("1 product");
    expect(describeUses([use("product", "p1"), use("product", "p2"), use("storefront-banner")])).toBe(
      "2 products and 1 storefront banner",
    );
    expect(describeUses([use("product"), use("category"), use("home-banner")])).toBe("1 product, 1 category and 1 home banner");
  });
});

describe("listLibrary", () => {
  it("pages by the declared size and never reports zero pages", async () => {
    repo.listForOrg.mockResolvedValue({ rows: [row()], total: MEDIA_LIBRARY_PAGE_SIZE + 1 });
    const result = await mediaAssetService.listLibrary("org-1", { usage: "all", retired: false, page: 1 });
    expect(result.pagination).toEqual({ page: 1, limit: MEDIA_LIBRARY_PAGE_SIZE, total: MEDIA_LIBRARY_PAGE_SIZE + 1, totalPages: 2 });
    repo.listForOrg.mockResolvedValue({ rows: [], total: 0 });
    expect((await mediaAssetService.listLibrary("org-1", { usage: "all", retired: false, page: 1 })).pagination.totalPages).toBe(1);
  });
});

describe("retire", () => {
  it("is not found for another org's asset — the read is scoped, so the id alone opens nothing", async () => {
    repo.findForOrg.mockResolvedValue(null);
    await expect(mediaAssetService.retire("org-2", "a1")).rejects.toMatchObject({ name: "NotFoundError" });
    expect(repo.retireUnused).not.toHaveBeenCalled();
  });

  it("is idempotent: retiring a retired image writes nothing", async () => {
    repo.findForOrg.mockResolvedValue(row({ state: "RETIRED", retiredAt: new Date() }));
    const dto = await mediaAssetService.retire("org-1", "a1");
    expect(dto.state).toBe("RETIRED");
    expect(repo.retireUnused).not.toHaveBeenCalled();
  });

  it("refuses, naming the uses, when the conditional write moves nothing", async () => {
    repo.findForOrg.mockResolvedValue(row());
    repo.referencedRefs.mockResolvedValue(new Set());
    repo.retireUnused.mockResolvedValue(false);
    repo.usesOf.mockResolvedValue([
      { kind: "product", id: "p1", label: "Attar", slot: "front" },
      { kind: "storefront-banner", id: "b1", label: "Sale", slot: null },
    ]);
    await expect(mediaAssetService.retire("org-1", "a1")).rejects.toMatchObject({
      name: "ConflictError",
      message: "This image is still used by 1 product and 1 storefront banner. Remove it there first.",
    });
  });

  it("refuses when a URL still shows it even though no row links the asset", async () => {
    repo.findForOrg.mockResolvedValue(row());
    repo.referencedRefs.mockResolvedValue(new Set(["https://img.test/p/a.webp"]));
    repo.usesOf.mockResolvedValue([]);
    await expect(mediaAssetService.retire("org-1", "a1")).rejects.toMatchObject({
      name: "ConflictError",
      message: expect.stringContaining("a page that still shows it"),
    });
    expect(repo.retireUnused).not.toHaveBeenCalled();
  });

  it("retires an unused image and hands back the retired record", async () => {
    const now = new Date("2026-09-27T12:00:00Z");
    repo.findForOrg.mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ state: "RETIRED", retiredAt: now }));
    repo.referencedRefs.mockResolvedValue(new Set());
    repo.retireUnused.mockResolvedValue(true);
    const dto = await mediaAssetService.retire("org-1", "a1", now);
    expect(repo.retireUnused).toHaveBeenCalledWith("org-1", "a1", now);
    expect(dto).toMatchObject({ state: "RETIRED", retiredAt: now.toISOString() });
  });
});

describe("sweepRetiredObjects", () => {
  it("deletes the object of an image retired past the grace period, keeps one a URL still shows, and leaves the rows", async () => {
    const now = new Date("2026-09-27T12:00:00Z");
    repo.findStaleRetired.mockResolvedValue([
      { id: "r1", ref: "https://img.test/gone.webp", objectKey: "gone.webp" },
      { id: "r2", ref: "https://img.test/shown.webp", objectKey: "shown.webp" },
    ]);
    repo.referencedRefs.mockResolvedValue(new Set(["https://img.test/shown.webp"]));
    const result = await mediaAssetService.sweepRetiredObjects(now);
    expect(repo.findStaleRetired).toHaveBeenCalledWith(new Date(now.getTime() - RETIRED_OBJECT_GRACE_MS));
    expect(store.deleteObject).toHaveBeenCalledTimes(1);
    expect(store.deleteObject).toHaveBeenCalledWith("https://img.test/gone.webp");
    expect(repo.clearObject).toHaveBeenCalledWith("r1");
    expect(result).toEqual({ deleted: 1, kept: 1 });
  });

  it("the grace period is thirty days — long enough that a retirement in error costs nothing", () => {
    expect(RETIRED_OBJECT_GRACE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("sweep runs both passes and reports each", async () => {
    repo.findStalePending.mockResolvedValue([]);
    repo.findStaleRetired.mockResolvedValue([]);
    expect(await mediaAssetService.sweep()).toEqual({ pending: { removed: 0, kept: 0 }, retired: { deleted: 0, kept: 0 } });
  });
});
