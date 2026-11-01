import type { ReactNode } from "react";
import Link from "next/link";

import { APP_NAME } from "@/lib/config";
import {
  COMPOSITIONS,
  SECTION,
  THEMES,
  type CompositionEntry,
  type SectionKey,
  type ThemeKey,
} from "@server/catalog/storefront-themes";
import { ThemedCollections } from "./collections";
import { ThemedDeals } from "./deals";
import { ThemedHero } from "./hero";
import {
  bestSellingSlice,
  collectionsSlice,
  dealsSlice,
  heroSlice,
  newInSlice,
  reviewsSlice,
  storySlice,
  visitSlice,
  whyBuySlice,
  type ThemedPageData,
} from "./page-data";
import { ThemedReviews } from "./reviews";
import { ProductShelf } from "./shelf";
import { ThemedStory } from "./story";
import { ThemedVisit } from "./visit";
import { ThemedWhyBuy } from "./why-buy";

interface Context {
  page: ThemedPageData;
  theme: ThemeKey;
}

type Renderers = {
  [S in SectionKey]: (
    entry: Extract<CompositionEntry, { section: S }>,
    context: Context,
  ) => ReactNode;
};

/**
 * One renderer per section, chosen by key; each returns nothing when its slice is empty, so
 * a page closes up rather than drawing a blank (R10). `satisfies` makes a section declared
 * in the registry without a renderer a compile error.
 */
const RENDER = {
  [SECTION.HERO]: ({ variant }, { page }) => <ThemedHero variant={variant} {...heroSlice(page)} />,
  [SECTION.COLLECTIONS]: ({ variant }, { page }) => {
    const slice = collectionsSlice(page);
    return slice && <ThemedCollections variant={variant} {...slice} />;
  },
  [SECTION.DEALS]: ({ variant }, { page, theme }) => {
    const slice = dealsSlice(page);
    return (
      slice && (
        <ThemedDeals
          variant={variant}
          {...slice}
          cardStyle={COMPOSITIONS[theme].cardStyle}
          columns={THEMES[theme].phoneColumns}
        />
      )
    );
  },
  [SECTION.BEST_SELLING]: ({ variant }, { page, theme }) => {
    const slice = bestSellingSlice(page);
    return slice && <Shelf title="Best selling" layout={variant} slice={slice} page={page} theme={theme} />;
  },
  [SECTION.NEW_IN]: ({ variant }, { page, theme }) => {
    const slice = newInSlice(page);
    return slice && <Shelf title="New in" layout={variant} slice={slice} page={page} theme={theme} />;
  },
  [SECTION.WHY_BUY]: ({ variant }, { page }) => {
    const slice = whyBuySlice(page);
    return slice && <ThemedWhyBuy variant={variant} {...slice} />;
  },
  [SECTION.STORY]: ({ variant }, { page }) => {
    const slice = storySlice(page);
    return slice && <ThemedStory variant={variant} {...slice} />;
  },
  [SECTION.REVIEWS]: ({ variant }, { page }) => {
    const slice = reviewsSlice(page);
    return slice && <ThemedReviews variant={variant} {...slice} />;
  },
  [SECTION.VISIT]: ({ variant }, { page }) => {
    const slice = visitSlice(page);
    return slice && <ThemedVisit variant={variant} {...slice} />;
  },
} satisfies Renderers;

function Shelf({
  title,
  layout,
  slice,
  page,
  theme,
}: {
  title: string;
  layout: "grid" | "rail" | "byCategory";
  slice: NonNullable<ReturnType<typeof newInSlice>>;
  page: ThemedPageData;
  theme: ThemeKey;
}) {
  const categoryNames = Object.fromEntries(page.collections.map((c) => [c.slug, c.name]));
  return (
    <ProductShelf
      {...slice}
      title={title}
      layout={layout}
      cardStyle={COMPOSITIONS[theme].cardStyle}
      columns={THEMES[theme].phoneColumns}
      categoryNames={categoryNames}
    />
  );
}

/** With nothing on sale the page is the shop's name, its words and where to find it (ux.md, landing Empty). */
const WHILE_EMPTY: ReadonlySet<SectionKey> = new Set([SECTION.HERO, SECTION.STORY, SECTION.VISIT]);

function render<E extends CompositionEntry>(entry: E, context: Context): ReactNode {
  const renderer = RENDER[entry.section] as (entry: E, context: Context) => ReactNode;
  return renderer(entry, context);
}

/** A theme's landing sections in its own order and variants (D1, D8; ADR-0064). */
export function ThemedSections({ theme, page }: { theme: ThemeKey; page: ThemedPageData }) {
  const empty = page.productCount === 0;
  const entries = COMPOSITIONS[theme].sections.filter((e) => !empty || WHILE_EMPTY.has(e.section));
  const context = { page, theme };

  return (
    <>
      {entries.map((entry) => {
        const node = render(entry, context);
        if (!node) return null;
        return (
          <div key={entry.section} data-section={entry.section}>
            {node}
            {empty && entry.section === SECTION.HERO && <SettingUp name={page.name} />}
          </div>
        );
      })}
    </>
  );
}

function SettingUp({ name }: { name: string }) {
  return (
    <section className="mx-auto max-w-store space-y-3 px-gutter py-section text-center">
      <p className="break-words font-display text-title">{name} is setting up. Check back soon.</p>
      <Link href="/" prefetch={false} className="font-label text-tag uppercase tracking-tag underline underline-offset-4">
        Shop all of {APP_NAME}
      </Link>
    </section>
  );
}
