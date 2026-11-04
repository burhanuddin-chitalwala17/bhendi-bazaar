import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

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
import { PREVIEW_COPY } from "../preview/preview-copy";
import { THEMED_COPY } from "./themed-copy";

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
    return slice && <Shelf title={THEMED_COPY.sections.bestSelling} layout={variant} slice={slice} page={page} theme={theme} />;
  },
  [SECTION.NEW_IN]: ({ variant }, { page, theme }) => {
    const slice = newInSlice(page);
    return slice && <Shelf title={THEMED_COPY.sections.newIn} layout={variant} slice={slice} page={page} theme={theme} />;
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

/**
 * A theme's landing sections in its own order and variants (D1, D8; ADR-0064). `preview` is the
 * owner's view (D12, D13): a hero with no photo carries "Add a photo", and a hidden section stays
 * as a slim line to tap, so the sheet that hid it can show it again (Q43). Buyers get neither.
 */
export function ThemedSections({ theme, page, preview = false }: { theme: ThemeKey; page: ThemedPageData; preview?: boolean }) {
  const empty = page.productCount === 0;
  const entries = COMPOSITIONS[theme].sections.filter((e) => !empty || WHILE_EMPTY.has(e.section));
  const context = { page, theme };

  return (
    <>
      {entries.map((entry) => {
        if (preview && (page.hiddenSections as readonly string[]).includes(entry.section)) {
          return (
            <div key={entry.section} data-section={entry.section} className="mx-auto max-w-store px-gutter py-3">
              <p className="rounded-field border border-dashed border-border p-3 text-center font-label text-tag text-muted-foreground">
                {PREVIEW_COPY.hidden}
              </p>
            </div>
          );
        }
        const node = render(entry, context);
        if (!node) return null;
        const askPhoto = preview && entry.section === SECTION.HERO && page.heroPhotos.length === 0;
        return (
          <div key={entry.section} data-section={entry.section} className={askPhoto ? "relative" : undefined}>
            {node}
            {askPhoto && (
              <span className="absolute right-gutter top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-3 py-1.5 font-label text-tag text-foreground shadow-overlay">
                <Icon name="add-photo" size="xs" />
                {PREVIEW_COPY.addPhoto}
              </span>
            )}
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
