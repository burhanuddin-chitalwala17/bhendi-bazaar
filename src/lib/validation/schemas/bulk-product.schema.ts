import { z } from "zod";
import { rupeeAmount } from "./common.schemas";
import { parseYoutubeRef, MAX_MEDIA_PER_PRODUCT } from "@server/catalog/media";
import type { RawSheetRow } from "@server/catalog/bulk/sheet";
import type { BulkProductRow, RowError } from "@server/catalog/bulk/bulk.types";

/**
 * One sheet row → one typed product row (bulk-catalog-upload D1).
 *
 * The same rules the single-product form enforces, restated over sheet cells —
 * and like every write path, server-owned fields (slug, rating, flags) have no
 * column to arrive through. Semantic checks that need the database (category
 * exists, locations match, SKU free) live in the bulk service, not here.
 */

const STOCK_PREFIX = "stock:";

const list = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

const numberCell = (raw: string | undefined): number | undefined => {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

const rowShape = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(255),
  description: z.string().trim().min(1, "Description is required").max(5000),
  price: rupeeAmount("Price"),
  categorySlug: z.string().trim().min(1, "Category is required"),
  sku: z.string().trim().max(64).optional(),
  weight: z
    .number({ message: "Weight is required" })
    .positive("Weight must be greater than 0"),
  sizes: z.array(z.string()),
  colors: z.array(z.string()),
  tags: z.array(z.string()),
  images: z
    .array(z.string())
    .min(1, "Name at least one image file")
    .max(MAX_MEDIA_PER_PRODUCT, `At most ${MAX_MEDIA_PER_PRODUCT} gallery items`),
  cover: z.string().trim().optional(),
  videoRef: z.string().optional(),
  stock: z.record(
    z.string(),
    z.number().int("Stock must be a whole number").min(0, "Stock cannot be negative")
  ),
});

/**
 * Parse one raw sheet row. Returns the typed row or the row's errors — never both.
 */
export function parseBulkProductRow(
  raw: RawSheetRow
): { row: BulkProductRow } | { errors: RowError[] } {
  const errors: RowError[] = [];
  const cells = raw.cells;

  const images = list(cells["images"]);
  const video = (cells["video"] ?? "").trim();
  let videoRef: string | undefined;
  if (video) {
    const ref = parseYoutubeRef(video);
    if (ref) videoRef = ref;
    else errors.push({ row: raw.rowNumber, field: "video", message: `Not a YouTube link: "${video}"` });
  }
  // Video counts against the same gallery cap as photographs (media R14).
  if (videoRef && images.length >= MAX_MEDIA_PER_PRODUCT) {
    errors.push({
      row: raw.rowNumber,
      field: "images",
      message: `At most ${MAX_MEDIA_PER_PRODUCT} gallery items including the video`,
    });
  }

  const stock: Record<string, number> = {};
  for (const [header, value] of Object.entries(cells)) {
    if (!header.startsWith(STOCK_PREFIX)) continue;
    const location = header.slice(STOCK_PREFIX.length).trim();
    const qty = numberCell(value);
    if (qty === undefined) continue; // an empty stock cell means none there
    stock[location] = qty as number;
  }

  const candidate = {
    name: cells["name"] ?? "",
    description: cells["description"] ?? "",
    price: numberCell(cells["price"]),
    categorySlug: (cells["category"] ?? "").toLowerCase(),
    sku: (cells["sku"] ?? "").trim() || undefined,
    weight: numberCell(cells["weight"]),
    sizes: list(cells["sizes"]),
    colors: list(cells["colors"]),
    tags: list(cells["tags"]),
    images,
    cover: (cells["cover"] ?? "").trim() || undefined,
    videoRef,
    stock,
  };

  const parsed = rowShape.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        row: raw.rowNumber,
        field: String(issue.path[0] ?? "row"),
        message: issue.message,
      });
    }
  }
  if (errors.length) return { errors };
  return { row: parsed.data as BulkProductRow };
}

/** Blob URL the browser got back from the client upload — and nowhere else. */
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

/**
 * The create payload: validated rows come back with their uploaded image URLs.
 * Re-validated in full on the server — validate-then-create is two requests, and
 * nothing stops a client editing the payload in between (Invariant 4).
 */
export const bulkProductCreateSchema = z.object({
  rows: z
    .array(
      rowShape.extend({
        imageUrls: z.record(z.string(), blobUrl),
      })
    )
    .min(1, "Nothing to create")
    .max(300, "At most 300 rows per upload"),
});

export type BulkProductCreatePayload = z.infer<typeof bulkProductCreateSchema>;
