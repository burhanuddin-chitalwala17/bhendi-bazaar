/** The category template, generated from live accents and current slugs (D7). */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import ExcelJS from "exceljs";
import { CategoryAccent } from "@prisma/client";
import { categoryRepository } from "@server/catalog/category.repository";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const existing = (await categoryRepository.listTree()).map((c) => c.slug);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Categories");
    sheet.addRow(["name", "description", "parent", "accent", "order", "image"]);
    sheet.getRow(1).font = { bold: true };
    sheet.addRow(["Abayas", "Elegant everyday and occasion abayas.", "", "EMERALD", 1, "abayas/hero.jpg"]);
    sheet.addRow(["Silk Abayas", "The silk end of the abaya rail.", "abayas", "PURPLE", 2, "silk-abayas/hero.jpg"]);

    const notes = workbook.addWorksheet("How to fill");
    notes.addRow(["Column", "What goes in it"]);
    notes.getRow(1).font = { bold: true };
    notes.addRow(["parent", `Blank for a top-level category, or a slug: an existing one (${existing.join(", ") || "none yet"}) or an earlier row of this sheet.`]);
    notes.addRow(["accent", `One of: ${Object.values(CategoryAccent).join(", ")}`]);
    notes.addRow(["image", "The hero image you will upload next. If you upload a folder, include it — abayas/hero.jpg — so two rows can each have a hero.jpg."]);
    notes.getColumn(1).width = 12;
    notes.getColumn(2).width = 100;

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
