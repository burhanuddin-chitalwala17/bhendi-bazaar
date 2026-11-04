import { CategoryLanes } from "@/components/category/category-lanes";
import { SectionHeader } from "@/components/shared/SectionHeader";
import type { CategoriesSlice } from "./sections";
import { BRAND_PAGE_COPY } from "./brand-page-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * What they sell, as the storefront's own category rail (brand-page D5). A tile narrows
 * the shop's grid the way the landing page's rail does, so the two pages agree on what a
 * category tap means.
 */
export function BrandCategories({ handle, categories }: CategoriesSlice) {
  return (
    <section className="space-y-3">
      <SectionHeader overline={BRAND_PAGE_COPY.overline} title={BRAND_PAGE_COPY.whatTheySell} />
      <CategoryLanes
        categories={categories}
        hrefFor={(category) => `${ROUTES.store(handle)}?category=${category.slug}`}
      />
    </section>
  );
}
