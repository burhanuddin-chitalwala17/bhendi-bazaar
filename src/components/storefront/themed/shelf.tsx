import type { Product } from "@/domain/product";
import { cn } from "@/lib/utils";
import type { CardStyle } from "@server/catalog/storefront-themes";
import type { ShelfSlice } from "./page-data";
import { SectionHeading, shopAllLabel, shopHref } from "./section-heading";
import { ThemedProductCard } from "./themed-product-card";

export type ShelfLayout = "grid" | "rail" | "byCategory";

/** Grid columns by phone density (Daily 3-up, others 2-up; spec Theme cards, "Grid"). */
export const GRID: Record<2 | 3, { cols: string; sizes: string }> = {
  2: { cols: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4", sizes: "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" },
  3: { cols: "grid-cols-3 md:grid-cols-4 lg:grid-cols-5", sizes: "(min-width: 1024px) 20vw, (min-width: 768px) 25vw, 33vw" },
};
export const RAIL_ITEM: Record<2 | 3, { width: string; sizes: string }> = {
  2: { width: "w-[42%] md:w-[28%] lg:w-[22%]", sizes: "(min-width: 1024px) 22vw, (min-width: 768px) 28vw, 42vw" },
  3: { width: "w-[30%] md:w-[22%] lg:w-[18%]", sizes: "(min-width: 1024px) 18vw, (min-width: 768px) 22vw, 30vw" },
};

/**
 * Best selling and new in share one shelf (Q8, Q23): a grid, a rail, or Daily's rails by
 * category. Never more than the slice carries; "Shop all {n}" is the way to the rest.
 */
export function ProductShelf({
  title,
  layout,
  cardStyle,
  columns,
  categoryNames,
  handle,
  products,
  productCount,
}: ShelfSlice & {
  title: string;
  layout: ShelfLayout;
  cardStyle: CardStyle;
  columns: 2 | 3;
  /** A slug's shown name, when the shop picked that collection: rail titles and the Edge spec line. */
  categoryNames?: Record<string, string>;
}) {
  const action = { label: shopAllLabel(productCount), href: shopHref(handle) };
  const rows =
    layout === "byCategory"
      ? byCategory(products, categoryNames ?? {}, title)
      : [{ key: "all", title: null, products }];

  return (
    <section className="mx-auto max-w-store space-y-6 px-gutter py-section">
      <SectionHeading title={title} action={action} />
      {rows.map((row) => (
        <div key={row.key} className="space-y-3">
          {row.title && <h3 className="font-display text-body font-semibold">{row.title}</h3>}
          {layout === "grid" ? (
            <ul className={cn("grid gap-grid", GRID[columns].cols)}>
              {row.products.map((p) => (
                <li key={p.id}>
                  <ThemedProductCard product={p} shopHandle={handle} cardStyle={cardStyle} sizes={GRID[columns].sizes} categoryName={categoryNames?.[p.categorySlug]} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="no-scrollbar -mx-gutter flex snap-x gap-grid overflow-x-auto px-gutter">
              {row.products.map((p) => (
                <li key={p.id} className={cn("shrink-0 snap-start", RAIL_ITEM[columns].width)}>
                  <ThemedProductCard product={p} shopHandle={handle} cardStyle={cardStyle} sizes={RAIL_ITEM[columns].sizes} categoryName={categoryNames?.[p.categorySlug]} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

/**
 * One rail per category the shop named, in best-selling order; a category with a single product
 * would be a rail of one, so those join a last rail under the shelf's own title.
 */
function byCategory(products: Product[], names: Record<string, string>, fallback: string) {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const key = names[product.categorySlug] ? product.categorySlug : "";
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }
  const rows: { key: string; title: string | null; products: Product[] }[] = [];
  const rest: Product[] = [];
  for (const [slug, items] of groups) {
    if (slug && items.length > 1) rows.push({ key: slug, title: names[slug], products: items });
    else rest.push(...items);
  }
  if (rest.length) rows.push({ key: "rest", title: rows.length ? `More ${fallback.toLowerCase()}` : null, products: rest });
  return rows;
}
