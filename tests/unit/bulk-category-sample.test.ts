// The accent column is a closed set of theme colours, and an admin filling row 40 is
// not reading the instructions tab. The sheet has to refuse a wrong value itself.
import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { CategoryAccent } from "@prisma/client";

vi.mock("@/lib/admin-auth", () => ({ requirePlatformAdmin: async () => ({}) }));
vi.mock("@server/catalog/category.repository", () => ({
  categoryRepository: {
    list: async () => [{ name: "Abayas", slug: "abayas", order: 0 }],
  },
}));
vi.mock("@server/shared/prisma", () => ({ prisma: {} }));

const { GET } = await import("@/app/api/admin/categories/bulk/sample/route");

const workbook = async () => {
  const response = await GET();
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await response.arrayBuffer());
  return book;
};

describe("the category sample sheet", () => {
  it("puts every theme colour behind a dropdown on the accent column", async () => {
    const sheet = (await workbook()).getWorksheet("Categories")!;
    const validation = sheet.getCell("D2").dataValidation;

    expect(validation?.type).toBe("list");
    for (const accent of Object.values(CategoryAccent)) {
      expect(validation?.formulae?.[0]).toContain(accent);
    }
  });

  it("carries the dropdown down to the last row an upload may hold", async () => {
    // A validation on the two example rows only is worse than none: it looks
    // authoritative and stops exactly where people start typing.
    const sheet = (await workbook()).getWorksheet("Categories")!;
    expect(sheet.getCell("D50").dataValidation?.type).toBe("list");
    expect(sheet.getCell("D301").dataValidation?.type).toBe("list");
  });

  it("rejects anything else outright rather than warning", async () => {
    const sheet = (await workbook()).getWorksheet("Categories")!;
    expect(sheet.getCell("D2").dataValidation?.errorStyle).toBe("error");
  });

  it("lists the colours on their own tab, from the one palette module", async () => {
    const palette = (await workbook()).getWorksheet("Theme colours")!;
    expect(palette.rowCount).toBe(Object.values(CategoryAccent).length + 1);
  });

  it("shows the example child naming its parent by name, not by slug", async () => {
    const sheet = (await workbook()).getWorksheet("Categories")!;
    expect(sheet.getCell("A2").value).toBe("Example Category");
    expect(sheet.getCell("C3").value).toBe("Example Category");
  });
});
