import type { FieldChange, ProductTeamEditDto } from "@server/catalog/product-team";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";

/** The shop's words for the team's edits (product-form ux.md "Shop product notice and history"). */
export const TEAM_EDIT_COPY = {
  badge: (at: Date | string) => `Edited by Bhendi Bazaar team · ${day(at)}`,
  seeWhatChanged: "See what changed",
  title: "Changes by Bhendi Bazaar team",
  loadFailed: "Couldn't load the history.",
  tryAgain: "Try again",
  showAll: "Show all changes",
  more: "More",
  created: "Added this product",
} as const;

/** The anchor "See what changed" opens on the product page. */
export const TEAM_HISTORY_ANCHOR = "team-history";

/** Newest this many, then "Show all changes" (ux Many items). */
export const HISTORY_SHOWN = 5;

const day = (at: Date | string) => formatDate(at, { day: "numeric", month: "short" });

const LABEL: Record<string, string> = {
  price: "Price",
  salePrice: "Sale price",
  stock: "Stock",
  name: "Name",
  description: "Description",
  category: "Category",
  sku: "SKU",
  weight: "Weight",
  lowStockThreshold: "Low-stock alert",
  tags: "Tags",
  flags: "Badges",
  kind: "Kind",
  familyId: "Family",
  brandId: "Brand",
  media: "Photos and video",
};
const MONEY = new Set(["price", "salePrice"]);
/** Ids and gallery refs mean nothing to the shop: the line says the field changed, not the values. */
const OPAQUE = new Set(["familyId", "brandId", "media"]);

/** `sleeveLength` → "Sleeve length". */
const words = (key: string) => {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

function label(change: FieldChange): string {
  // A stock row's `at` is "{location} ({id})": the shop knows the name, not the id.
  if (change.field === "stock") return `Stock at ${(change.at ?? "").replace(/\s*\([^)]*\)$/, "")}`;
  if (change.at) return words(change.at);
  return LABEL[change.field] ?? words(change.field);
}

function shown(field: string, value: FieldChange["before"]): string {
  if (value === null) return "—";
  if (MONEY.has(field) && typeof value === "number") return formatCurrency(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** "Price ₹2,499 → ₹2,299", or "Family changed" for a value the shop cannot read. */
export function changeText(change: FieldChange): string {
  if (OPAQUE.has(change.field)) return `${label(change)} changed`;
  return `${label(change)} ${shown(change.field, change.before)} → ${shown(change.field, change.after)}`;
}

/** "Bhendi Bazaar team · 30 Oct, 4:12 pm · Price ₹2,499 → ₹2,299 · 'Shop asked to fix the price'". */
export function historyLine(edit: ProductTeamEditDto): string {
  const what = edit.created ? TEAM_EDIT_COPY.created : edit.changes.map(changeText).join(" · ");
  return [`Bhendi Bazaar team · ${day(edit.at)}, ${formatTime(edit.at)}`, what, `'${edit.reason}'`].filter(Boolean).join(" · ");
}
