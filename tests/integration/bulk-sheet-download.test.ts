/**
 * own-store/bulk-sheet U1 against the real vocabulary: the sheet a shop downloads for its ticks,
 * filled the way a seller fills it, reads back clean — and its example row is never a product (A5).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import ExcelJS from "exceljs";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

// The route's own branch is under test, not the portal guard: the scope is handed straight in.
vi.mock("@/lib/org-auth", () => ({
  withOrg:
    (handler: (request: Request, scope: object, params: { orgId: string }) => Promise<Response>) =>
    async (request: Request, context: { params: Promise<{ orgId: string }> }) => {
      const params = await context.params;
      return handler(request, { orgId: params.orgId, role: "OWNER", userId: "bulk-sheet-test" }, params);
    },
}));

describe.skipIf(!isDisposableDb)("bulk sheet download (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let bulkSheetService: typeof import("@server/catalog/bulk/bulk-sheet.service").bulkSheetService;
  let parseSheet: typeof import("@server/catalog/bulk/sheet").parseSheet;
  let parseBulkProductRow: typeof import("@/lib/validation/schemas/bulk-product.schema").parseBulkProductRow;
  let validateProductRows: typeof import("@server/catalog/bulk/bulk-product.service").validateProductRows;
  let orgId: string;
  let categoryId: string;
  let categorySlug: string;
  let typeLabel: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ bulkSheetService } = await import("@server/catalog/bulk/bulk-sheet.service"));
    ({ parseSheet } = await import("@server/catalog/bulk/sheet"));
    ({ parseBulkProductRow } = await import("@/lib/validation/schemas/bulk-product.schema"));
    ({ validateProductRows } = await import("@server/catalog/bulk/bulk-product.service"));
    const fixtures = await ensureFixtures();
    ({ orgId, categoryId, categorySlug } = fixtures);
    await prisma.category.update({ where: { id: categoryId }, data: { productType: "islamic-wear" } });
    typeLabel = (await prisma.productType.findUniqueOrThrow({ where: { key: "islamic-wear" } })).label;
  });

  afterAll(async () => {
    await prisma.category.update({ where: { id: categoryId }, data: { productType: null } });
  });

  it("offers the fixture category under its type's tab, and knows the shop has a location (R1)", async () => {
    const choices = await bulkSheetService.choices(orgId);
    const group = choices.groups.find((g) => g.label === typeLabel);
    expect(group?.categories.map((c) => c.id)).toContain(categoryId);
    expect(choices.hasLocation).toBe(true);
  });

  it("reads a filled downloaded sheet clean, skipping the example (A5)", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await bulkSheetService.buildSheet(orgId, [categoryId])) as unknown as ArrayBuffer);
    const tab = workbook.getWorksheet(typeLabel)!;
    expect(workbook.worksheets[0].name).toBe("Instructions");
    const keys = (tab.getRow(2).values as unknown[]).map((v) => String(v ?? ""));
    const fill = (key: string, value: string | number) => (tab.getCell(5, keys.indexOf(key)).value = value);
    fill("name", "Plain Black Rida");
    fill("description", "A rida");
    fill("price", 1999);
    fill("category", categorySlug);
    fill("weight", 0.5);
    fill("images", "a.jpg");
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const sheet = await parseSheet(buffer, "sheet.xlsx");
    expect(sheet.rows.map((row) => row.rowNumber)).toEqual([5]);
    const parsed = parseBulkProductRow(sheet.rows[0]);
    if ("errors" in parsed) throw new Error(JSON.stringify(parsed.errors));
    expect(await validateProductRows(orgId, [{ rowNumber: 5, row: parsed.row }], ["a.jpg"])).toEqual([]);
  });

  // own-store/bulk-sheet U2: the words a dropdown offers are words the upload reads (R2, R5).
  it("R2 — a row filled from the dropdowns' own words validates clean", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await bulkSheetService.buildSheet(orgId, [categoryId])) as unknown as ArrayBuffer);
    const tab = workbook.getWorksheet(typeLabel)!;
    const keys = (tab.getRow(2).values as unknown[]).map((v) => String(v ?? ""));
    const category = tab.getCell(4, keys.indexOf("category")).value;
    // The path a person reads, not the slug (the fixture category is a root, so its path is its name).
    const named = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } });
    expect(category).toBe(named.parentId ? expect.stringContaining(named.name) : named.name);
    expect(category).not.toBe(categorySlug);
    // The example row holds a word from each list; copied down, they are what a seller picks.
    keys.forEach((key, column) => {
      const validation = tab.getCell(5, column).dataValidation;
      if (column > 1 && validation?.type === "list" && key !== "family") {
        tab.getCell(5, column).value = tab.getCell(4, column).value;
      }
    });
    tab.getCell(5, keys.indexOf("name")).value = "Rida from the lists";
    tab.getCell(5, keys.indexOf("description")).value = "d";
    tab.getCell(5, keys.indexOf("price")).value = 999;
    tab.getCell(5, keys.indexOf("weight")).value = 0.5;
    tab.getCell(5, keys.indexOf("images")).value = "a.jpg";
    const sheet = await parseSheet(Buffer.from(await workbook.xlsx.writeBuffer()), "sheet.xlsx");
    const parsed = parseBulkProductRow(sheet.rows[0]);
    if ("errors" in parsed) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.row.categorySlug).toBe(String(category));
    expect(await validateProductRows(orgId, [{ rowNumber: 5, row: parsed.row }], ["a.jpg"])).toEqual([]);
  });

  // own-store/bulk-sheet U3: the upload is judged against today's sheet for the same ticks (A3, D4).
  it("A3 — a fresh download reads silently; once the shop's lists change it is warned, not refused", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await bulkSheetService.buildSheet(orgId, [categoryId])) as unknown as ArrayBuffer);
    const tab = workbook.getWorksheet(typeLabel)!;
    const keys = (tab.getRow(2).values as unknown[]).map((v) => String(v ?? ""));
    tab.getCell(5, keys.indexOf("name")).value = "Rida";
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const fresh = await bulkSheetService.judgeUpload(orgId, await parseSheet(buffer, "sheet.xlsx"));
    expect(fresh).toMatchObject({ stale: false, refusedColumn: null });
    expect(fresh.version).toMatch(/^[0-9a-f]{6}$/);

    const brand = await prisma.brand.create({ data: { orgId, name: `u3-stamp-brand-${Date.now()}` } });
    try {
      const later = await bulkSheetService.judgeUpload(orgId, await parseSheet(buffer, "sheet.xlsx"));
      expect(later).toMatchObject({ stale: true, refusedColumn: null, version: fresh.version, madeOn: fresh.madeOn });
    } finally {
      await prisma.brand.delete({ where: { id: brand.id } });
    }
  });

  it("D4 — the check route refuses a sheet whose column no longer reads, judging no row by it", async () => {
    const { POST } = await import("@/app/api/org/[orgId]/products/bulk/validate/route");
    const { SHEET_AGE_COPY } = await import("@server/catalog/bulk/sheet-copy");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await bulkSheetService.buildSheet(orgId, [categoryId])) as unknown as ArrayBuffer);
    const tab = workbook.getWorksheet(typeLabel)!;
    const keys = (tab.getRow(2).values as unknown[]).map((v) => String(v ?? ""));
    tab.getCell(5, keys.indexOf("name")).value = "Rida";
    // A column today's sheet no longer has, as a fact later removed from the type would leave.
    tab.getCell(1, keys.length).value = "Lining";
    tab.getCell(2, keys.length).value = "u3-removed-fact";
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const brand = await prisma.brand.create({ data: { orgId, name: `u3-refuse-brand-${Date.now()}` } });
    try {
      const form = new FormData();
      form.set("sheet", new File([buffer], "sheet.xlsx"));
      form.set("filenames", "[]");
      const response = await POST(
        new Request(`http://localhost/api/org/${orgId}/products/bulk/validate`, { method: "POST", body: form }) as never,
        { params: Promise.resolve({ orgId }) },
      );
      const report = await response.json();
      expect(report).toMatchObject({ ok: false, rows: [], plan: { creates: 0, updates: 0 } });
      expect(report.sheet.refusedColumn).toBe("Lining");
      expect(report.errors).toEqual([{ row: 0, field: "sheet", message: SHEET_AGE_COPY.tooOld("Lining") }]);
    } finally {
      await prisma.brand.delete({ where: { id: brand.id } });
    }
  });
});
