/**
 * The downloadable template, generated per org from live data (D7) — its stock
 * columns are the org's real pickup locations and its category examples are
 * current slugs, so the template cannot drift from what validation expects.
 */
import ExcelJS from "exceljs";

export interface SampleSheetContext {
  orgName: string;
  locationNames: string[];
  categorySlugs: string[];
}

const FIXED_HEADERS = [
  "name", "description", "price", "category", "sku", "weight",
  "sizes", "colors", "tags", "images", "cover", "video",
] as const;

export async function buildProductSampleSheet(ctx: SampleSheetContext): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");

  const headers = [...FIXED_HEADERS, ...ctx.locationNames.map((name) => `stock:${name}`)];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };

  const category = ctx.categorySlugs[0] ?? "category-slug";
  const stockExample = ctx.locationNames.map((_, i) => (i === 0 ? 12 : 0));
  sheet.addRow([
    "Emerald Silk Abaya", "Hand-finished silk abaya with emerald embroidery.",
    2499.0, category, "ABAYA-001", 0.6,
    "S;M;L", "Emerald;Black", "abaya;silk",
    "emerald-abaya/front.jpg;emerald-abaya/back.jpg", "emerald-abaya/front.jpg",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ...stockExample,
  ]);
  sheet.addRow([
    "Rose Musk Attar", "Concentrated rose musk attar, 12ml.",
    499.5, ctx.categorySlugs[1] ?? category, "", 0.05,
    "", "", "attar;fragrance",
    "rose-attar/front.jpg", "", "",
    ...ctx.locationNames.map(() => 5),
  ]);

  const notes = workbook.addWorksheet("How to fill");
  notes.addRow(["Column", "What goes in it"]);
  notes.getRow(1).font = { bold: true };
  ([
    ["name", "Product name, 2+ characters."],
    ["description", "Required."],
    ["price", "Rupees, e.g. 2499 or 499.50."],
    ["category", `One of: ${ctx.categorySlugs.join(", ") || "(no categories yet)"}`],
    ["sku", "Your own code, optional — unique within your organisation."],
    ["weight", "Kilograms, e.g. 0.6."],
    ["sizes / colors / tags", "Separate multiple values with ; (semicolon)."],
    ["images", "Photos for this row, ; separated, in gallery order. First one is the cover unless 'cover' says otherwise."],
    ["", "If you upload a folder, include the folder: emerald-abaya/front.jpg — that is how two products can each have a front.jpg."],
    ["cover", "Optional: which of this row's images is the cover. Write it exactly as in the images column."],
    ["video", "Optional: a YouTube link."],
    ...ctx.locationNames.map((name) => [
      `stock:${name}`,
      "Quantity at this pickup location. Leave empty or 0 for none.",
    ]),
  ] as [string, string][]).forEach((row) => notes.addRow(row));
  notes.getColumn(1).width = 24;
  notes.getColumn(2).width = 90;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
