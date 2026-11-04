import type { PageTab } from "@/components/shared/page-tabs";
import type { ProductStats } from "../types";
import { PRODUCT_SHELF_COPY } from "@/components/product/console/console-copy";

export type ProductTabKey = "all" | "low" | "out" | "archived";

/** The params each tab owns; everything else in the URL (search, category) carries across. */
const OWN = ["shelf", "lowStock", "outOfStock", "page"];

const TAB_PARAMS: Record<ProductTabKey, Record<string, string>> = {
  all: {},
  low: { lowStock: "true" },
  out: { outOfStock: "true" },
  archived: { shelf: "archived" },
};

/** All / Low stock / Sold out / Archived, each a URL with its count (design-system products screen). */
export function productTabs(pathname: string, search: URLSearchParams | { toString(): string }, stats: ProductStats): PageTab[] {
  const href = (key: ProductTabKey) => {
    const params = new URLSearchParams(search.toString());
    OWN.forEach((name) => params.delete(name));
    Object.entries(TAB_PARAMS[key]).forEach(([name, value]) => params.set(name, value));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  return [
    { key: "all", label: PRODUCT_SHELF_COPY.all, href: href("all"), count: stats.totalProducts },
    { key: "low", label: PRODUCT_SHELF_COPY.lowStock, href: href("low"), count: stats.lowStockProducts },
    { key: "out", label: PRODUCT_SHELF_COPY.soldOut, href: href("out"), count: stats.outOfStockProducts },
    { key: "archived", label: PRODUCT_SHELF_COPY.archived, href: href("archived"), count: stats.archivedProducts },
  ];
}
