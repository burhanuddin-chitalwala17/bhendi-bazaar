/**
 * The downloadable template, built at the moment it is asked for.
 *
 * **Nothing in it is fixed.** Its columns come from the product types that exist now, its
 * dropdowns from the permitted answers that exist now, its stock columns from the org's real
 * pickup locations and its category examples from current slugs. Adding a product type, a kind
 * or a colour changes the next sheet without anybody editing a file — and a template generated
 * once would go stale the first time one was added, invisibly, until an upload was rejected for
 * a column that no longer exists.
 *
 * One workbook spanning several types, Amazon's shape rather than Flipkart's and Meesho's
 * one-sheet-per-category — an org listing bags and attar fills one file, not two.
 */
import ExcelJS from "exceljs";

import type { ProductTypeRecord } from "@server/catalog/product-type.types";

import { sheetColumns, type SheetColumn } from "./sheet-columns";

export interface SampleSheetContext {
  orgName: string;
  locationNames: string[];
  categorySlugs: string[];
  /** The types this sheet spans. Empty means the spine only, which is still a usable sheet. */
  productTypes: ProductTypeRecord[];
  /** The permitted answers, by list, for whatever the types above ask about. */
  values: Record<string, Array<{ key: string; label: string }>>;
}

/** Excel refuses an inline list much past this, so a longer one goes to a lookup sheet. */
const MAX_INLINE_DROPDOWN = 255;

export async function buildProductSampleSheet(ctx: SampleSheetContext): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  const columns = sheetColumns(ctx.productTypes, ctx.locationNames);

  sheet.addRow(columns.map((column) => column.header));
  sheet.getRow(1).font = { bold: true };

  // The example rows go in **before** the dropdowns. `getCell` materialises a row, so applying
  // validation down to row 500 first would leave `addRow` appending at 501 — the examples land
  // below five hundred blanks and nobody filling the sheet ever sees them.
  addExampleRows(sheet, columns, ctx);

  // Long lists live on their own sheet and are referenced, because Excel's inline validation
  // has a length limit a 188-value colour list is well past.
  const lookups = workbook.addWorksheet("Answers");
  lookups.state = "veryHidden";
  const ranges = writeLookups(lookups, ctx.values);
  applyDropdowns(sheet, columns, ctx.values, ranges);
  writeNotes(workbook, columns, ctx);
  writeTypesSheet(workbook, ctx.productTypes);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Each list written down one column, so a dropdown can point at a range rather than a literal. */
function writeLookups(
  sheet: ExcelJS.Worksheet,
  values: SampleSheetContext["values"],
): Record<string, string> {
  const ranges: Record<string, string> = {};
  let column = 1;
  for (const [list, options] of Object.entries(values)) {
    if (options.length === 0) continue;
    sheet.getCell(1, column).value = list;
    options.forEach((option, index) => {
      sheet.getCell(index + 2, column).value = option.label;
    });
    const letter = sheet.getColumn(column).letter;
    ranges[list] = `Answers!$${letter}$2:$${letter}$${options.length + 1}`;
    column += 1;
  }
  return ranges;
}

/**
 * A dropdown per choice column, over enough rows for a real upload.
 *
 * `allowBlank` throughout: a fact nobody can answer is left empty and reported, never a reason
 * to refuse the row — nothing in this vocabulary blocks saving.
 */
function applyDropdowns(
  sheet: ExcelJS.Worksheet,
  columns: SheetColumn[],
  values: SampleSheetContext["values"],
  ranges: Record<string, string>,
) {
  const LAST_ROW = 500;
  columns.forEach((column, index) => {
    if (!column.list) return;
    const options = values[column.list];
    if (!options || options.length === 0) return;
    const letter = sheet.getColumn(index + 1).letter;
    const formula =
      options.length > MAX_INLINE_DROPDOWN || ranges[column.list]
        ? ranges[column.list]
        : `"${options.map((option) => option.label).join(",")}"`;
    if (!formula) return;
    for (let row = 2; row <= LAST_ROW; row += 1) {
      sheet.getCell(row, index + 1).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
      };
    }
  });
}

/**
 * Two placeholder rows. Deliberately not plausible: a template whose examples collide with the
 * real catalogue fails validation the first time anybody tries it.
 */
function addExampleRows(
  sheet: ExcelJS.Worksheet,
  columns: SheetColumn[],
  ctx: SampleSheetContext,
) {
  const first = ctx.productTypes[0];
  const example = (index: number) =>
    columns.map((column) => {
      switch (column.header) {
        case "productType":
          return first?.key ?? "";
        case "kind":
          return first?.kinds[0]?.key ?? "";
        case "name":
          return index === 0 ? "Example Product One" : "Example Product Two";
        case "description":
          return index === 0
            ? "Replace this row with your own product."
            : "A second row, showing the optional columns left empty.";
        case "price":
          return index === 0 ? 2499.0 : 499.5;
        case "category":
          return ctx.categorySlugs[index] ?? ctx.categorySlugs[0] ?? "category-slug";
        case "sku":
          return index === 0 ? "EXAMPLE-SKU-1" : "";
        case "weight":
          return index === 0 ? 0.6 : 0.05;
        case "tags":
          return "example;replace-me";
        case "images":
          return index === 0
            ? "example-product-one/front.jpg;example-product-one/back.jpg"
            : "example-product-two/front.jpg";
        default:
          return column.header.startsWith("stock:") ? (index === 0 ? 12 : 0) : "";
      }
    });
  sheet.addRow(example(0));
  sheet.addRow(example(1));
}

function writeNotes(
  workbook: ExcelJS.Workbook,
  columns: SheetColumn[],
  ctx: SampleSheetContext,
) {
  const notes = workbook.addWorksheet("How to fill");
  notes.addRow(["Column", "What goes in it"]);
  notes.getRow(1).font = { bold: true };

  notes.addRow([
    "",
    `Built for ${ctx.orgName} on ${new Date().toISOString().slice(0, 10)}. The columns below ` +
      "come from the product types this sheet was generated for — download it again after " +
      "adding a type, a kind or a colour, and the new ones appear.",
  ]);

  for (const column of columns) notes.addRow([column.header, column.note]);

  if (ctx.locationNames.length === 0) {
    notes.addRow([
      "stock: (none)",
      "This organisation has no pickup locations yet, so this sheet has no quantity columns. " +
        "Add them on the Locations page and download the sample again — one stock: column " +
        "appears per location.",
    ]);
  }

  notes.getColumn(1).width = 26;
  notes.getColumn(2).width = 96;
}

/** What each type asks for, so the person filling the sheet knows which columns are theirs. */
function writeTypesSheet(workbook: ExcelJS.Workbook, types: ProductTypeRecord[]) {
  const sheet = workbook.addWorksheet("Types");
  sheet.addRow(["productType", "Name", "Kinds", "Asks about", "Measures"]);
  sheet.getRow(1).font = { bold: true };
  for (const type of types) {
    sheet.addRow([
      type.key,
      type.label,
      type.kinds.map((kind) => kind.key).join(", "),
      type.facts.join(", "),
      type.measures.map((measure) => `${measure.key} (${measure.unit})`).join(", "),
    ]);
  }
  if (types.length === 0) {
    sheet.addRow(["", "No product types yet — this sheet carries the shared columns only.", "", "", ""]);
  }
  sheet.getColumn(1).width = 18;
  sheet.getColumn(2).width = 24;
  sheet.getColumn(3).width = 40;
  sheet.getColumn(4).width = 60;
  sheet.getColumn(5).width = 40;
}
