// Canonical URL slug rule. Slugs are server-generated and never accepted from a
// request body — a slug containing characters that need percent-encoding does not
// survive the round trip through a route param.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Derive a URL-safe slug from arbitrary text. Never throws; may return "". */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")           // split accents off their base letters
    .replace(/[\u0300-\u036f]/g, "") // drop the separated accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // any run of other characters becomes one hyphen
    .replace(/^-+|-+$/g, "");
}

/**
 * Candidate slugs for `text`, in preference order: the bare slug, then -2, -3, …
 * Callers attempt the insert and advance only on a unique-constraint violation —
 * querying for availability first is a race the database already arbitrates.
 */
export function* slugCandidates(text: string, fallback = "item"): Generator<string> {
  const base = slugify(text) || fallback;
  yield base;
  for (let n = 2; ; n++) yield `${base}-${n}`;
}

/**
 * True when a Prisma error is a unique-constraint violation on `field`.
 *
 * Two shapes, because they differ by driver: without a driver adapter Prisma sets
 * `meta.target`, but with `@prisma/adapter-pg` that is undefined and the columns
 * appear under `meta.driverAdapterError.cause.constraint.fields`. Checking only
 * the first shape silently disables every caller's retry.
 */
export function isUniqueViolation(error: unknown, field: string): boolean {
  const e = error as {
    code?: string;
    meta?: {
      target?: unknown;
      driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
    };
  };
  if (e?.code !== "P2002") return false;

  const target = e.meta?.target;
  if (Array.isArray(target) ? target.includes(field) : target === field) return true;

  const fields = e.meta?.driverAdapterError?.cause?.constraint?.fields;
  return Array.isArray(fields) && fields.includes(field);
}
