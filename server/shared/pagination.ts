export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * The page sizes every paginated table offers. Declared once so the select, the
 * route handlers and the repositories cannot disagree about what is allowed.
 */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 10;

/**
 * A page size arrives from a query string, so it is parsed against the closed set
 * rather than coerced — an unbounded `take` is a table scan a caller can ask for.
 */
export function resolvePageSize(
  value: unknown,
  fallback: PageSize = DEFAULT_PAGE_SIZE
): PageSize {
  const size = Number(value);
  return PAGE_SIZE_OPTIONS.find((option) => option === size) ?? fallback;
}

/** Page numbers come from the same untrusted place; a non-positive skip is a bug. */
export function resolvePageNumber(value: unknown): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * A sort column arrives from a query string and is spread straight into Prisma's
 * `orderBy: { [sortBy]: sortOrder }`, so it is resolved against the closed set the
 * caller declares rather than cast to it. `searchParams.get("sortBy") as any` compiled
 * and typechecked while letting an arbitrary string reach the query builder — the
 * compile-time fiction Invariant 4 is about, one layer along from a request body.
 *
 * The allowed set lives at the call site because it is per-listing, and it is the same
 * union the filter type already declares — passing anything else stops compiling.
 */
export function resolveSortBy<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  return allowed.includes(value as T[number]) ? (value as T[number]) : fallback;
}

export const SORT_ORDERS = ["asc", "desc"] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];

/** Same reasoning, and only ever two answers. */
export function resolveSortOrder(value: unknown, fallback: SortOrder = "desc"): SortOrder {
  return SORT_ORDERS.find((order) => order === value) ?? fallback;
}
