import { Fragment, type ReactNode } from "react";

import type { BrandPage } from "@/data-access-layer/storefront.dal";
import { BrandCategories } from "./brand-categories";
import { BrandHero } from "./brand-hero";
import { BrandPillars } from "./brand-pillars";
import { BrandStory } from "./brand-story";
import { BrandsCarried } from "./brands-carried";
import { BuyersSay } from "./buyers-say";
import { NewestGoods } from "./newest-goods";
import {
  brandPageSections,
  brandsSlice,
  buyersSaySlice,
  categoriesSlice,
  newestSlice,
  pillarsSlice,
  policiesSlice,
  socialSlice,
  storySlice,
  type BrandPageSection,
} from "./sections";
import { ShopPolicies } from "./shop-policies";
import { WaysToFollow } from "./ways-to-follow";

/**
 * The brand page's body: the sections `brandPageSections` says are present, in its order.
 *
 * Each renderer reads its slice through the same extractor that decided presence, so the
 * two cannot disagree — a section listed is a section with something to show. A server
 * component throughout: everything here is display over data the page already has.
 */
const RENDER: Record<BrandPageSection, (page: BrandPage) => ReactNode> = {
  hero: (page) => <BrandHero page={page} />,
  story: (page) => {
    const slice = storySlice(page);
    return slice && <BrandStory {...slice} />;
  },
  categories: (page) => {
    const slice = categoriesSlice(page);
    return slice && <BrandCategories {...slice} />;
  },
  pillars: (page) => {
    const slice = pillarsSlice(page);
    return slice && <BrandPillars {...slice} />;
  },
  brands: (page) => {
    const names = brandsSlice(page);
    return names && <BrandsCarried names={names} />;
  },
  buyersSay: (page) => {
    const slice = buyersSaySlice(page);
    return slice && <BuyersSay {...slice} />;
  },
  newest: (page) => <NewestGoods {...newestSlice(page)} />,
  policies: (page) => {
    const slice = policiesSlice(page);
    return slice && <ShopPolicies {...slice} />;
  },
  social: (page) => {
    const slice = socialSlice(page);
    return slice && <WaysToFollow {...slice} />;
  },
};

export function BrandPageSections({ page }: { page: BrandPage }) {
  return (
    <>
      {brandPageSections(page).map((key) => (
        <Fragment key={key}>{RENDER[key](page)}</Fragment>
      ))}
    </>
  );
}
