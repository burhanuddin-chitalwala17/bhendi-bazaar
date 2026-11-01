import { formatCurrency, formatDate, formatTime, rupeesToPaise } from "@/lib/format";
import { ApiError } from "@/lib/api-error";
import { STOCK_FIELD, VERSION_FIELD } from "@server/catalog/product-edit";
import type { ProductFormInput } from "@/components/product/console/types";
import type { ProductStepKey } from "./product-steps";

/** Why a save was refused because the product moved on: someone saved it, or stock sold (D6, ux Stale). */
export const EDIT_CONFLICT = { VERSION: "version", STOCK: "stock" } as const;
export type EditConflict = (typeof EDIT_CONFLICT)[keyof typeof EDIT_CONFLICT];

export function editConflictOf(error: unknown): EditConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const paths = error.details.map((detail) => detail.path);
  if (paths.includes(VERSION_FIELD)) return EDIT_CONFLICT.VERSION;
  if (paths.includes(STOCK_FIELD)) return EDIT_CONFLICT.STOCK;
  return null;
}

const totalStock = (rows: ProductFormInput["stockLocations"] | undefined) =>
  (rows ?? []).reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

/** ux Stale: "2 sold while you were editing. Stock is now 8." */
export function staleStockMessage(seenTotal: number, nowTotal: number): string {
  const sold = seenTotal - nowTotal;
  return sold > 0
    ? `${sold} sold while you were editing. Stock is now ${nowTotal}.`
    : `Stock changed while you were editing. Stock is now ${nowTotal}.`;
}

/** What each row held when the form loaded: the quantity a refused stock save compares against. */
export const seenStockTotal = (rows: ProductFormInput["stockLocations"] | undefined) =>
  (rows ?? []).reduce((sum, row) => sum + (row.seenQuantity ?? 0), 0);

const at = (source: unknown, path: string) =>
  path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], source);

/**
 * The latest product with the shop's own changes laid back over it (D8). `changed` is paths
 * ("facts.sleeve"), so inside facts only the answers the shop changed win. Stock keeps each typed
 * quantity but takes the latest `seenQuantity`, so the next save compares against what is stored
 * now; after a stock refusal the typed stock is not re-applied: the sale is the newer fact (ux Stale).
 */
export function rebase(
  latest: ProductFormInput,
  mine: ProductFormInput,
  changed: readonly string[],
  conflict: EditConflict,
): { values: ProductFormInput; kept: string[]; applied: string[] } {
  const values = { ...latest } as Record<string, unknown>;
  const kept = new Set<string>();
  const applied: string[] = [];
  for (const path of changed) {
    const [field, ...rest] = path.split(".");
    if (field === "stockLocations") {
      if (conflict === EDIT_CONFLICT.STOCK) continue;
      const typed = new Map(mine.stockLocations.map((row) => [row.orgAddressId, row.quantity]));
      values.stockLocations = latest.stockLocations.map((row) =>
        typed.has(row.orgAddressId) ? { ...row, quantity: typed.get(row.orgAddressId)! } : row,
      );
      applied.push(field);
    } else if (rest.length > 0) {
      // Copy each level on the way down, so `latest` is never written through.
      let target = values;
      for (const key of [field, ...rest.slice(0, -1)]) {
        target[key] = { ...((target[key] as Record<string, unknown> | undefined) ?? {}) };
        target = target[key] as Record<string, unknown>;
      }
      target[rest[rest.length - 1]] = at(mine, path);
      applied.push(path);
    } else {
      values[field] = at(mine, field);
      applied.push(field);
    }
    kept.add(field);
  }
  return { values: values as unknown as ProductFormInput, kept: [...kept], applied };
}

/** One value of `rebase`'s result by path, for setting it back on the form. */
export const valueAt = at;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One line per card on the edit overview (R7); empty parts are left out, never shown as blanks. */
export function sectionSummary(
  section: ProductStepKey,
  values: Partial<ProductFormInput>,
  categoryName: string | undefined,
): string {
  switch (section) {
    case "photos": {
      const media = values.media ?? [];
      const photos = media.filter((item) => item.kind === "IMAGE").length;
      const videos = media.length - photos;
      if (media.length === 0) return "No photos yet";
      return [plural(photos, "photo"), videos ? plural(videos, "video") : ""].filter(Boolean).join(" · ");
    }
    case "what":
      return [categoryName, values.name?.trim()].filter(Boolean).join(" · ");
    case "price": {
      const price = Number(values.price) || 0;
      const sale = Number(values.salePrice) || 0;
      const shown = sale > 0 ? `${formatCurrency(rupeesToPaise(sale))} on sale` : formatCurrency(rupeesToPaise(price));
      return `${shown} · ${totalStock(values.stockLocations)} in stock`;
    }
    case "details": {
      const answered = [...Object.values(values.facts ?? {}), ...Object.values(values.measurements ?? {})].filter(
        (value) => value !== null && value !== undefined && value !== "",
      ).length;
      return answered ? plural(answered, "detail") + " answered" : "No details yet";
    }
    case "review":
      return "How buyers see it";
  }
}

/** "4:05 pm" today, "30 Oct, 4:05 pm" before (ux copy deck, Draft). */
export function draftTime(savedAt: Date, now = new Date()): string {
  const time = formatTime(savedAt);
  const day = (d: Date) => formatDate(d, { day: "numeric", month: "short" });
  return day(savedAt) === day(now) ? time : `${day(savedAt)}, ${time}`;
}

/** ux copy deck, Draft. */
export const draftNotice = (savedAt: Date, now = new Date()) => `We kept what you typed at ${draftTime(savedAt, now)}.`;

/** ux State matrix, Stale: "We kept what you typed on 22 Oct. Use it?" */
export const staleDraftNotice = (savedAt: Date) =>
  `We kept what you typed on ${formatDate(savedAt, { day: "numeric", month: "short" })}. Use it?`;

/** How old a draft may be and still come back on its own (product-form D9). */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The version a draft was typed against, kept beside it so a save from it is compared (D9). */
export function seenVersionOf(meta: unknown): number | null {
  const value = (meta as { seenVersion?: unknown } | null | undefined)?.seenVersion;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** ux Edit overview, Partial: "Amazon will ask: Fabric". */
export const willAsk = (hint: { label: string; asks: string[] }) => `${hint.label} will ask: ${hint.asks.join(", ")}`;
