/**
 * own-store/bulk-sheet U4 against the real vocabulary: a downloaded sheet with a misspelt colour
 * and no price comes back from the marker route with both cells red and one Problems line (A4),
 * and once fixed, the same file checks clean (R6). Nothing is created by either (Q19).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import ExcelJS from "exceljs";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

vi.mock("@/lib/org-auth", () => ({
  withOrg:
    (handler: (request: Request, scope: object, params: { orgId: string }) => Promise<Response>) =>
    async (request: Request, context: { params: Promise<{ orgId: string }> }) => {
      const params = await context.params;
      return handler(request, { orgId: params.orgId, role: "OWNER", userId: "bulk-marker-test" }, params);
    },
}));

const TYPE = "islamic-wear";

describe.skipIf(!isDisposableDb)("bulk sheet marker (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let bulkSheetService: typeof import("@server/catalog/bulk/bulk-sheet.service").bulkSheetService;
  let orgId: string;
  let categoryId: string;
  let typeLabel: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ bulkSheetService } = await import("@server/catalog/bulk/bulk-sheet.service"));
    ({ orgId, categoryId } = await ensureFixtures());
    await prisma.category.update({ where: { id: categoryId }, data: { productType: TYPE } });
    typeLabel = (await prisma.productType.findUniqueOrThrow({ where: { key: TYPE } })).label;
  });

  afterAll(async () => {
    await prisma.category.update({ where: { id: categoryId }, data: { productType: null } });
  });

  /** The downloaded sheet, row 7 filled from the example's own words but a colour typed wrong and no price. */
  async function filledSheet() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await bulkSheetService.buildSheet(orgId, [categoryId])) as unknown as ArrayBuffer);
    const tab = workbook.getWorksheet(typeLabel)!;
    const keys = (tab.getRow(2).values as unknown[]).map((v) => String(v ?? ""));
    const col = (key: string) => keys.indexOf(key);
    expect(col("colour")).toBeGreaterThan(0);
    const colour = String(tab.getCell(4, col("colour")).value);
    tab.getCell(7, col("name")).value = "U4 marked rida";
    tab.getCell(7, col("description")).value = "d";
    tab.getCell(7, col("category")).value = tab.getCell(4, col("category")).value;
    tab.getCell(7, col("weight")).value = 0.5;
    tab.getCell(7, col("images")).value = "a.jpg";
    // One letter dropped, as a seller types it: close enough to name the listed one.
    tab.getCell(7, col("colour")).value = colour.slice(0, 1) + colour.slice(2);
    return { workbook, tab, col, colour };
  }

  async function post(route: "marker" | "validate", buffer: Buffer) {
    const { POST } =
      route === "marker"
        ? await import("@/app/api/org/[orgId]/products/bulk/marker/route")
        : await import("@/app/api/org/[orgId]/products/bulk/validate/route");
    const form = new FormData();
    form.set("sheet", new File([new Uint8Array(buffer)], "my sheet.xlsx"));
    form.set("filenames", JSON.stringify(["a.jpg"]));
    return POST(
      new Request(`http://localhost/api/org/${orgId}/products/bulk/${route}`, { method: "POST", body: form }) as never,
      { params: Promise.resolve({ orgId }) },
    );
  }

  it("A4 — the marker answers the shop's file with both cells red and both problems on row 7", async () => {
    const { workbook, col, colour } = await filledSheet();
    const before = await prisma.product.count({ where: { orgId } });
    const response = await post("marker", Buffer.from(await workbook.xlsx.writeBuffer()));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("my-sheet-problems-marked.xlsx");

    const marked = new ExcelJS.Workbook();
    await marked.xlsx.load(await response.arrayBuffer());
    const tab = marked.getWorksheet(typeLabel)!;
    const problems = String(tab.getCell(7, 1).value);
    expect(problems.startsWith("Price missing · ")).toBe(true);
    expect(problems).toContain("isn't in the list — pick from the dropdown");
    expect(problems).toContain(`Did you mean '${colour}'?`);
    const red = (cell: ExcelJS.Cell) => (cell.fill?.type === "pattern" ? cell.fill.fgColor?.argb : undefined);
    expect(red(tab.getCell(7, col("price")))).toBe("FFFFC7CE");
    expect(red(tab.getCell(7, col("colour")))).toBe("FFFFC7CE");
    expect(red(tab.getCell(7, col("name")))).toBeUndefined();
    expect(await prisma.product.count({ where: { orgId } })).toBe(before);
  });

  it("A4 — a cell the shape refuses is named once, not again by the catalogue check", async () => {
    const { workbook, tab, col } = await filledSheet();
    tab.getCell(7, col("category")).value = null;
    const report = await (await post("validate", Buffer.from(await workbook.xlsx.writeBuffer()))).json();
    const onCategory = report.errors.filter((e: { column?: string; field: string }) => e.field.toLowerCase().startsWith("category"));
    expect(onCategory.map((e: { message: string }) => e.message)).toEqual(["Category is required"]);
  });

  it("R6 — the marked file, fixed in place, checks clean", async () => {
    const first = await filledSheet();
    const response = await post("marker", Buffer.from(await first.workbook.xlsx.writeBuffer()));
    const marked = new ExcelJS.Workbook();
    await marked.xlsx.load(await response.arrayBuffer());
    const tab = marked.getWorksheet(typeLabel)!;
    tab.getCell(7, first.col("price")).value = 1499;
    tab.getCell(7, first.col("colour")).value = first.colour;

    const report = await (await post("validate", Buffer.from(await marked.xlsx.writeBuffer()))).json();
    expect(report.errors).toEqual([]);
    expect(report).toMatchObject({ ok: true, plan: { creates: 1, updates: 0 } });
  });
});
