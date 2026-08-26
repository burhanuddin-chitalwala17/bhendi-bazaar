import { z } from "zod";
import { CategoryAccent } from "@prisma/client";
import type { RawSheetRow } from "@server/catalog/bulk/sheet";
import type { RowError } from "@server/catalog/bulk/bulk.types";
import type { BulkCategoryRow } from "@server/catalog/bulk/bulk-category.service";

/** One category sheet row → one typed row. Slug is server-generated (Invariant 4). */
const rowShape = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  description: z.string().trim().min(1, "Description is required").max(2000),
  parent: z.string().trim().toLowerCase().optional(),
  accent: z.enum(CategoryAccent, { message: "Not a valid accent — see the sample sheet" }).optional(),
  order: z.number().int().min(0).optional(),
  image: z.string().trim().min(1, "Name the hero image file"),
});

export function parseBulkCategoryRow(
  raw: RawSheetRow
): { row: BulkCategoryRow } | { errors: RowError[] } {
  const cells = raw.cells;
  const orderRaw = (cells["order"] ?? "").trim();
  const parsed = rowShape.safeParse({
    name: cells["name"] ?? "",
    description: cells["description"] ?? "",
    parent: (cells["parent"] ?? "").trim() || undefined,
    accent: (cells["accent"] ?? "").trim().toUpperCase() || undefined,
    order: orderRaw ? Number(orderRaw) : undefined,
    image: cells["image"] ?? "",
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((issue) => ({
        row: raw.rowNumber,
        field: String(issue.path[0] ?? "row"),
        message: issue.message,
      })),
    };
  }
  return { row: parsed.data };
}

const blobUrl = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
      } catch {
        return false;
      }
    },
    { message: "Image URLs must come from the upload step" }
  );

export const bulkCategoryCreateSchema = z.object({
  rows: z
    .array(rowShape.extend({ imageUrl: blobUrl }))
    .min(1, "Nothing to create")
    .max(300, "At most 300 rows per upload"),
});
