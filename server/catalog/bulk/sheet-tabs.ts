import { resolveProductType } from "@server/listing/product-type";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

import { normaliseWord, wordMatcher, type WordMatcher } from "./word-match";

/** One tab of the downloaded workbook: a type, and the ticked categories its rows go under. */
export interface SheetTab {
  name: string;
  /** Null for the Other tab — categories with no type ask no type's questions. */
  type: ProductTypeRecord | null;
  categorySlugs: string[];
}

export interface TickableCategory {
  id: string;
  parentId: string | null;
  slug: string;
  productType?: string | null;
}

export const OTHER_TAB = "Other";
/** The hidden tab every dropdown reads its words from (D3). */
export const LISTS_TAB = "Lists";
export const PATH_SEPARATOR = " › ";

/** Excel refuses a sheet name over 31 characters or holding any of these. */
function tabName(label: string): string {
  return label.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || OTHER_TAB;
}

/**
 * Ticked categories → tabs, one per type they resolve to (own-store/bulk-sheet D1, Q3).
 * Nothing ticked still makes a usable sheet: one Other tab over every category (ux.md).
 */
export function planSheetTabs(
  tickedIds: readonly string[],
  categories: readonly TickableCategory[],
  types: readonly ProductTypeRecord[],
): SheetTab[] {
  const ticked = new Set(tickedIds);
  const chosen = ticked.size ? categories.filter((c) => ticked.has(c.id)) : [];
  if (chosen.length === 0) {
    return [{ name: OTHER_TAB, type: null, categorySlugs: categories.map((c) => c.slug) }];
  }

  const typeByKey = new Map(types.map((type) => [type.key, type]));
  const slugsByType = new Map<string | null, string[]>();
  for (const category of chosen) {
    const key = resolveProductType(category.id, categories);
    const typeKey = key && typeByKey.has(key) ? key : null;
    slugsByType.set(typeKey, [...(slugsByType.get(typeKey) ?? []), category.slug]);
  }

  // Two labels can clean to one name, and Excel refuses a workbook with a repeated sheet name.
  const used = new Set<string>([OTHER_TAB, "Instructions", LISTS_TAB]);
  const unique = (name: string) => {
    let candidate = name;
    for (let n = 2; used.has(candidate); n += 1) candidate = `${name.slice(0, 28)} ${n}`;
    used.add(candidate);
    return candidate;
  };
  const typed = types
    .filter((type) => slugsByType.has(type.key))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((type) => ({ name: unique(tabName(type.label)), type, categorySlugs: slugsByType.get(type.key)!.sort() }));
  const other = slugsByType.get(null);
  return other ? [...typed, { name: OTHER_TAB, type: null, categorySlugs: other.sort() }] : typed;
}

/** A category as the download page ticks it: by its path, so look-alike names stay apart (Q6). */
export interface TickChoice {
  id: string;
  path: string;
}

export interface TickGroup {
  /** The tab this group becomes: the type's label, or Other. */
  label: string;
  categories: TickChoice[];
}

/** Each category's path, "Women › Abayas" — the words a person reads, and unique where names are not (Q6). */
export function categoryPaths(
  categories: readonly { id: string; parentId: string | null; name: string }[],
): Map<string, string> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const paths = new Map<string, string>();
  for (const category of categories) {
    const names: string[] = [];
    const seen = new Set<string>();
    for (let at: (typeof categories)[number] | undefined = category; at && !seen.has(at.id); at = at.parentId ? byId.get(at.parentId) : undefined) {
      seen.add(at.id);
      names.unshift(at.name);
    }
    paths.set(category.id, names.join(PATH_SEPARATOR));
  }
  return paths;
}

/** A category cell → its category, by full path or slug, never a bare name (D6). */
export function categoryMatcher<C extends { id: string; parentId: string | null; name: string; slug: string }>(
  categories: readonly C[],
): WordMatcher<C> {
  const paths = categoryPaths(categories);
  // A name two categories share is listed for both, so it matches neither — even where it is one's slug.
  const counts = new Map<string, number>();
  for (const { name } of categories) counts.set(normaliseWord(name), (counts.get(normaliseWord(name)) ?? 0) + 1);
  return wordMatcher(
    categories.map((category) => {
      const path = paths.get(category.id)!;
      const shared = (counts.get(normaliseWord(category.name)) ?? 0) > 1;
      return { value: category, label: path, words: shared ? [path, category.slug, category.name] : [path, category.slug] };
    }),
  );
}

/** Every category under the tab it would make, for the ticks grouped by type (R1, Q2). */
export function groupForTicking(
  categories: readonly (TickableCategory & { name: string })[],
  types: readonly ProductTypeRecord[],
): TickGroup[] {
  const paths = categoryPaths(categories);
  const tabs = planSheetTabs(categories.map((c) => c.id), categories, types);
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  return tabs.map((tab) => ({
    label: tab.name,
    categories: tab.categorySlugs
      .map((slug) => bySlug.get(slug)!)
      .map((category) => ({ id: category.id, path: paths.get(category.id)! }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  }));
}
