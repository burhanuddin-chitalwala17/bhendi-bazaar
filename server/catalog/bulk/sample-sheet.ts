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

  // With no pickup locations there are no stock columns to generate, and a
  // template that is silently missing a section is worse than one that explains
  // itself — otherwise the sheet gets filled in and the quantities have nowhere to go.
  const headers = [...FIXED_HEADERS, ...ctx.locationNames.map((name) => `stock:${name}`)];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };

  const category = ctx.categorySlugs[0] ?? "category-slug";
  const stockExample = ctx.locationNames.map((_, i) => (i === 0 ? 12 : 0));
  // Placeholder names and SKUs, not plausible ones: a template whose example rows
  // collide with the real catalogue fails validation the first time anyone tries it.
  sheet.addRow([
    "Example Product One", "Replace this row with your own product.",
    2499.0, category, "EXAMPLE-SKU-1", 0.6,
    "S;M;L", "Emerald;Black", "example;replace-me",
    "example-product-one/front.jpg;example-product-one/back.jpg",
    "example-product-one/front.jpg",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ...stockExample,
  ]);
  sheet.addRow([
    "Example Product Two", "A second row, showing the optional columns left empty.",
    499.5, ctx.categorySlugs[1] ?? category, "", 0.05,
    "", "", "example;replace-me",
    "example-product-two/front.jpg", "", "",
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
    ...(ctx.locationNames.length
      ? ctx.locationNames.map((name) => [
          `stock:${name}`,
          "Quantity at this pickup location. Leave empty or 0 for none.",
        ])
      : [
          [
            "stock: (none)",
            "This organisation has no pickup locations yet, so this sheet has no " +
              "quantity columns. Add your locations on the Locations page, then " +
              "download this sample again — one stock: column appears per location.",
          ],
        ]),
  ] as [string, string][]).forEach((row) => notes.addRow(row));
  notes.getColumn(1).width = 24;
  notes.getColumn(2).width = 90;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
