/** The category template, generated from live accents and current names (D7). */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import ExcelJS from "exceljs";
import { CategoryAccent } from "@prisma/client";
import { CATEGORY_ACCENTS } from "@/lib/category-accent";
import { categoryRepository } from "@server/catalog/category.repository";
import { BULK_MAX_ROWS } from "@server/catalog/bulk/bulk.types";

const ACCENTS = Object.values(CategoryAccent);
const ACCENT_COLUMN = "D";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const existing = (await categoryRepository.list()).map((c) => c.name);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Categories");
    sheet.addRow(["name", "description", "parent", "accent", "order", "image"]);
    sheet.getRow(1).font = { bold: true };
    // Placeholder names, not plausible ones: a template whose example rows collide
    // with the real catalogue fails validation the first time anyone tries it.
    sheet.addRow(["Example Category", "Replace this row with your own.", "", "EMERALD", 1, "example-category/hero.jpg"]);
    sheet.addRow(["Example Subcategory", "Shows how a child names its parent.", "Example Category", "PURPLE", 2, "example-subcategory/hero.jpg"]);

    // A dropdown, not a note on another tab: the accent column is a closed set, and
    // an admin filling row 40 is not reading the instructions. Excel refuses
    // anything else outright, so a typo never reaches the check step.
    for (let row = 2; row <= BULK_MAX_ROWS + 1; row++) {
      sheet.getCell(`${ACCENT_COLUMN}${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${ACCENTS.join(",")}"`],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "Not a theme colour",
        error: `Pick one of the ${ACCENTS.length} theme colours from the dropdown.`,
      };
    }
    sheet.getColumn(1).width = 24;
    sheet.getColumn(2).width = 44;
    sheet.getColumn(3).width = 24;
    sheet.getColumn(6).width = 30;

    const notes = workbook.addWorksheet("How to fill");
    notes.addRow(["Column", "What goes in it"]);
    notes.getRow(1).font = { bold: true };
    notes.addRow(["parent", `Blank for a top-level category, or the parent's name — exactly as written in its own name cell. An existing category (${existing.join(", ") || "none yet"}) or a row of this sheet. A parent defined in this sheet must sit ABOVE its children.`]);
    notes.addRow(["accent", `The category's theme colour — pick from the dropdown in that column. ${ACCENTS.length} available.`]);
    notes.addRow(["order", "Optional. Leave blank and rows are appended after the last existing category, in sheet order."]);
    notes.addRow(["image", "The hero image you will upload next. If you upload a folder, include it — abayas/hero.jpg — so two rows can each have a hero.jpg."]);
    notes.getColumn(1).width = 12;
    notes.getColumn(2).width = 100;

    const palette = workbook.addWorksheet("Theme colours");
    palette.addRow(["value", "colour"]);
    palette.getRow(1).font = { bold: true };
    for (const accent of ACCENTS) {
      palette.addRow([accent, CATEGORY_ACCENTS[accent].label]);
    }
    palette.getColumn(1).width = 14;
    palette.getColumn(2).width = 14;

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="bulk-categories-sample.xlsx"',
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Could not build the sample sheet");
  }
}
