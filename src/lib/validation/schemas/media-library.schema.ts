import { z } from "zod";
import { MediaAssetKind, MediaAssetSource, MediaTag } from "@prisma/client";

/**
 * The library's filters (media-library spec R6), arriving as a query string from a plain GET form
 * or the picker. Every field is optional and a blank means "any"; the page number is the only
 * default. Parsed, never cast: an unknown kind or source is refused, not passed to Prisma.
 */
export const MEDIA_USAGE = ["all", "used", "unused"] as const;
export type MediaUsage = (typeof MEDIA_USAGE)[number];

function endOfDay(value: Date): Date {
  const end = new Date(value);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** A GET form sends "" for an untouched field; that is "any", not an invalid value. */
const orBlank = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" || value === null ? undefined : value), schema.optional());

export const mediaLibraryFilterSchema = z.object({
  kind: orBlank(z.enum(MediaAssetKind)),
  usage: orBlank(z.enum(MEDIA_USAGE)).transform((value) => value ?? "all"),
  source: orBlank(z.enum(MediaAssetSource)),
  from: orBlank(z.coerce.date()),
  // A date picked as "to" means the whole of that day, not the midnight that starts it.
  to: orBlank(z.coerce.date().transform(endOfDay)),
  productId: orBlank(z.string().min(1).max(64)),
  slot: orBlank(z.string().min(1).max(40)),
  retired: orBlank(z.enum(["1"])).transform((value) => value === "1"),
  tag: orBlank(z.enum(MediaTag)),
  page: orBlank(z.coerce.number().int().positive()).transform((value) => value ?? 1),
});

export type MediaLibraryFilters = z.output<typeof mediaLibraryFilterSchema>;

/** The same parse for `URLSearchParams` and Next's `searchParams` object. */
export function parseMediaLibraryFilters(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): MediaLibraryFilters {
  const raw: Record<string, string | undefined> = {};
  if (input instanceof URLSearchParams) {
    for (const [key, value] of input) raw[key] = value;
  } else {
    for (const [key, value] of Object.entries(input)) raw[key] = Array.isArray(value) ? value[0] : value;
  }
  return mediaLibraryFilterSchema.parse(raw);
}

/**
 * The poster an org member chooses for a hosted video (video-hosting spec R8): a photograph's asset
 * id, or null to go back to the frame the worker cut. Whether the photograph is theirs and ready is
 * the service's question, not the schema's.
 */
export const videoPosterSchema = z.object({
  posterAssetId: z.string().trim().min(1).max(64).nullable(),
});

export type VideoPosterInput = z.infer<typeof videoPosterSchema>;

/** A shop switching one tag on or off on one of its images (ai-images/media-tags R6). */
export const mediaTagSchema = z.object({
  tag: z.enum(MediaTag),
  on: z.boolean(),
});

export type MediaTagInput = z.infer<typeof mediaTagSchema>;

/** The most ids one bulk request carries (bulk-actions Q10); the bar sends more in batches of this. */
export const MEDIA_BULK_MAX_IDS = 100;

/** A bulk library action's selection: at most 100 ids (bulk-actions Q10), each counted once. */
export const mediaBulkSchema = z.object({
  ids: z
    .array(z.string().min(1).max(64))
    .min(1)
    .max(MEDIA_BULK_MAX_IDS)
    .transform((ids) => [...new Set(ids)]),
});

export type MediaBulkInput = z.infer<typeof mediaBulkSchema>;

/** One tag added to or removed from a selection; two explicit directions, never a toggle (Q6). */
export const mediaBulkTagSchema = mediaBulkSchema.extend(mediaTagSchema.shape);

export type MediaBulkTagInput = z.infer<typeof mediaBulkTagSchema>;

/**
 * Why the platform took an image down (spec R12).
 *
 * Required and bounded: an org reads this instead of asking an admin what happened, so an
 * empty reason would leave them with a picture gone and no account of it.
 */
export const platformRetireSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(4, "Say why this is coming down; the shop will read it.")
    .max(280),
});

export type PlatformRetireInput = z.infer<typeof platformRetireSchema>;
