import { z } from "zod";
import { MediaAssetKind, MediaAssetSource } from "@prisma/client";

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
