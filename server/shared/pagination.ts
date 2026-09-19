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
