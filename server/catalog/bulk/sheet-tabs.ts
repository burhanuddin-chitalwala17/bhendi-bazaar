import { resolveProductType } from "@server/listing/product-type";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

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
  const used = new Set<string>([OTHER_TAB, "Instructions", "Answers"]);
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

/** Every category under the tab it would make, for the ticks grouped by type (R1, Q2). */
export function groupForTicking(
  categories: readonly (TickableCategory & { name: string })[],
  types: readonly ProductTypeRecord[],
): TickGroup[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const pathOf = (category: TickableCategory & { name: string }) => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (let at: typeof category | undefined = category; at && !seen.has(at.id); at = at.parentId ? byId.get(at.parentId) : undefined) {
      seen.add(at.id);
      names.unshift(at.name);
    }
    return names.join(" › ");
  };
  const tabs = planSheetTabs(categories.map((c) => c.id), categories, types);
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  return tabs.map((tab) => ({
    label: tab.name,
    categories: tab.categorySlugs
      .map((slug) => bySlug.get(slug)!)
      .map((category) => ({ id: category.id, path: pathOf(category) }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  }));
}
