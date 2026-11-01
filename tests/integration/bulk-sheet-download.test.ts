/**
 * own-store/bulk-sheet U1 against the real vocabulary: the sheet a shop downloads for its ticks,
 * filled the way a seller fills it, reads back clean — and its example row is never a product (A5).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import ExcelJS from "exceljs";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

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
});
