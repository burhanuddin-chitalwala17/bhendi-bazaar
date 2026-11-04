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
  findById: vi.fn(),
  findReadyByHash: vi.fn(),
  createReady: vi.fn(),
  listIn: vi.fn(),
  findAnywhere: vi.fn(),
  retireByPlatform: vi.fn(),
  retireRenditionsOf: vi.fn(),
  findRendition: vi.fn(),
};
const audit = { recordAdminAction: vi.fn() };
vi.mock("@server/shared/audit/audit.service", () => audit);
const store = {
  deleteObject: vi.fn(),
  publicUrlFor: (key: string) => `https://img.test/${key}`,
  presignUpload: vi.fn(),
  headObject: vi.fn(),
  getObject: vi.fn(),
  putObject: vi.fn(),
};
vi.mock("@server/catalog/media-asset.repository", () => ({ mediaAssetRepository: repo }));
vi.mock("@server/catalog/object-store", () => store);

const { mediaAssetService, RETIRED_OBJECT_GRACE_MS } = await import("@server/catalog/media-asset.service");
const { mediaLibraryFilterSchema, parseMediaLibraryFilters } = await import("@/lib/validation/schemas/media-library.schema");
const { MEDIA_LIBRARY_PAGE_SIZE, describeUses, toMediaAssetDto, totalUses } = await import(
  "@server/catalog/media-library.types"
);

const counts = (overrides: Partial<Record<string, number>> = {}) => ({
  productMedia: 0,
  categoryHeroes: 0,
  profileLogos: 0,
  profileHeroes: 0,
  storefrontSlots: 0,
  orgBanners: 0,
  banners: 0,
  orgBannerPhones: 0,
  storefrontSlotPhones: 0,
  bannerPhones: 0,
  derivatives: 0,
  postersFor: 0,
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
  durationMs: null,
  failureReason: null,
  createdAt: new Date("2026-09-27T08:00:00Z"),
  orgId: "org_1",
  retiredAt: null,
  retiredBy: null,
  retiredReason: null,
  derivatives: [],
  posterAsset: null,
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

  it("a 'to' date covers the whole of that day, so a range ending today includes today's uploads", () => {
    const parsed = parseMediaLibraryFilters(new URLSearchParams("from=2026-09-01&to=2026-09-27"));
    expect(parsed.from).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(parsed.to).toEqual(new Date("2026-09-27T23:59:59.999Z"));
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
    expect(totalUses(counts())).toBe(0);
    // Lineage is not a use: a crop of this photograph does not make the photograph "in use".
    expect(totalUses(counts({ derivatives: 3 }))).toBe(0);
    expect(toMediaAssetDto(row({ _count: counts({ derivatives: 3 }) })).derivedCount).toBe(3);
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

describe("what the sheet may offer", () => {
  it("says a poster was chosen only when a photograph stands in — there is nothing else to undo", () => {
    expect(toMediaAssetDto(row()).posterChosen).toBe(false);
    expect(toMediaAssetDto(row({ posterAsset: { ref: "https://img.test/chosen.webp" } })).posterChosen).toBe(true);
  });
});

describe("a crop of something already stored", () => {
  beforeEach(() => vi.resetAllMocks());

  it("is refused when the photo is not this org's ready image", async () => {
    repo.findForOrg.mockResolvedValue(null);
    await expect(
      mediaAssetService.cropAsset("org-2", "u1", "a1", { rotation: 0, crop: { x: 0, y: 0, width: 10, height: 10 } }),
    ).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("refuses a frame the picture cannot give, rather than storing a broken one", async () => {
    repo.findForOrg.mockResolvedValue(row());
    repo.findById.mockResolvedValue({ ...row(), objectKey: "products/o/a.webp", orgId: "org-1" });
    store.getObject.mockResolvedValue(Buffer.from("not an image"));
    await expect(
      mediaAssetService.cropAsset("org-1", "u1", "a1", { rotation: 0, crop: { x: 0, y: 0, width: 10, height: 10 } }),
    ).rejects.toThrow(/falls outside the photo/);
  });
});

describe("the platform owner's view of every library (R12, trd D10)", () => {
  beforeEach(() => {
    audit.recordAdminAction.mockReset().mockResolvedValue(undefined);
  });

  it("asks one query for every library, one library, or the platform's own", async () => {
    repo.listIn.mockResolvedValue({ rows: [], total: 0 });
    const filters = parseMediaLibraryFilters({});

    await mediaAssetService.listAnywhere(undefined, filters);
    await mediaAssetService.listAnywhere("org_1", filters);
    await mediaAssetService.listAnywhere(null, filters);

    // The scope is the only difference between the admin listing and the org's own. Two
    // queries would be two answers about what a library holds.
    expect(repo.listIn.mock.calls.map((call) => call[0])).toEqual([undefined, "org_1", null]);
  });

  it("takes an image down with its reason on the asset, not only in the trail", async () => {
    const before = row({ id: "a9", state: "READY", orgId: "org_1" });
    repo.findAnywhere.mockResolvedValueOnce(before).mockResolvedValueOnce(
      row({ id: "a9", state: "RETIRED", orgId: "org_1", retiredBy: "PLATFORM", retiredReason: "Not their photograph" }),
    );
    repo.retireByPlatform.mockResolvedValue(true);

    const dto = await mediaAssetService.retireAsPlatform("admin_1", "a9", "Not their photograph");

    expect(repo.retireByPlatform).toHaveBeenCalledWith("a9", "Not their photograph", expect.any(Date));
    // The shop reads this in its own library; an audit row it cannot see would not do.
    expect(dto.retiredBy).toBe("PLATFORM");
    expect(dto.retiredReason).toBe("Not their photograph");
  });

  it("does not wait for the image to be unused, unlike an org retiring its own", async () => {
    // A breach comes down while it is on a page. `usesOf` is the org path's question.
    repo.findAnywhere.mockResolvedValue(row({ id: "a9", state: "READY" }));
    repo.retireByPlatform.mockResolvedValue(true);

    await mediaAssetService.retireAsPlatform("admin_1", "a9", "Breaks the rules");

    expect(repo.usesOf).not.toHaveBeenCalled();
    expect(repo.retireUnused).not.toHaveBeenCalled();
  });

  it("records the action, naming the shop and the file", async () => {
    repo.findAnywhere.mockResolvedValue(row({ id: "a9", state: "READY", orgId: "org_7" }));
    repo.retireByPlatform.mockResolvedValue(true);

    await mediaAssetService.retireAsPlatform("admin_1", "a9", "Breaks the rules");

    expect(audit.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        adminId: "admin_1",
        action: "media.retire",
        resourceId: "a9",
        metadata: expect.objectContaining({ reason: "Breaks the rules", orgId: "org_7" }),
      }),
    );
  });

  it("is idempotent: taking down what is already down changes nothing and logs nothing", async () => {
    repo.findAnywhere.mockResolvedValue(row({ id: "a9", state: "RETIRED", retiredBy: "PLATFORM" }));

    await mediaAssetService.retireAsPlatform("admin_1", "a9", "Again");

    expect(repo.retireByPlatform).not.toHaveBeenCalled();
    expect(audit.recordAdminAction).not.toHaveBeenCalled();
  });

  it("refuses rather than reports success when the conditional write loses", async () => {
    repo.findAnywhere.mockResolvedValue(row({ id: "a9", state: "READY" }));
    repo.retireByPlatform.mockResolvedValue(false);

    await expect(mediaAssetService.retireAsPlatform("admin_1", "a9", "Breaks the rules")).rejects.toThrow(
      /already been taken down/,
    );
  });
});
