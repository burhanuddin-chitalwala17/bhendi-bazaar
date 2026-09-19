// One declaration, server-side, re-exported here so the two sides cannot drift.
export type { Pagination } from "@server/shared/pagination";
export {
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  resolvePageSize,
  resolvePageNumber,
  type PageSize,
} from "@server/shared/pagination";

export enum ProductFlag {
  FEATURED = "FEATURED",
  HERO = "HERO",
  ON_OFFER = "ON_OFFER",
  NEW_ARRIVAL = "NEW_ARRIVAL",
  CLEARANCE_SALE = "CLEARANCE_SALE",
}
