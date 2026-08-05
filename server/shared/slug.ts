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

// Constraint inspection lives in ./constraint — re-exported so slug callers
// keep a single import.
export { isUniqueViolation, uniqueViolationFields } from "@server/shared/constraint";
