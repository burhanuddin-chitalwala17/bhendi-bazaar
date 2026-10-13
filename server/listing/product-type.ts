import { z } from "zod";

import type { ProductTypeRecord } from "./product-type.types";

/**
 * Reading and resolving a product type. The types themselves are rows
 * ([product-types](../../docs/specs/listing-vocabulary/product-types/) D1); this module holds
 * what stays pure, so a page, a service and a test resolve one identically.
 *
 * A product type decides which questions a product is asked; it is **not** what a buyer browses.
 * `Category` is that, and a category says which type its products use (categories D1a). Named
 * after Amazon's own `product_type`, the same concept under the dominant published vocabulary.
 */

/** A key is a string the database vouches for: both columns carry a foreign key against it (D2). */
export const productTypeKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{0,39}$/, "A type key is lowercase letters, digits and hyphens");

/**
 * The wire shape for a category's chosen type: one of the keys that exist, or nothing.
 * `""` is what an unselected `<select>` submits.
 *
 * A factory rather than a constant, because the valid set is known at runtime now. The form
 * builds it from the options it was handed and the route from the database, so what a shop is
 * shown inline stays what the server enforces
 * ([ADR-0013](../../docs/adr/0013-one-error-envelope-and-useserverform.md)) — which a
 * runtime-known enum would otherwise cost. The foreign key is the backstop underneath.
 */
export function productTypeSchemaFor(available: readonly string[]) {
  const allowed = new Set(available);
  return z
    .union([z.string().trim(), z.null()])
    .transform((value) => (value === "" || value === null ? null : value))
    .refine((value) => value === null || allowed.has(value), {
      message: "Choose one of the listed product types",
    });
}

export function parseProductTypeKey(value: unknown): string | null {
  const parsed = productTypeKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Enough of a category to resolve a type from: the tree walk needs nothing else. */
export interface ProductTypeSource {
  id: string;
  parentId?: string | null;
  productType?: unknown;
}

/**
 * The type key a category's products use: its own, else the nearest ancestor's, else none
 * (categories D1a). Mirrors `resolveShotList` deliberately — same tree, same walk, and the
 * `seen` set is what stops a cycle in a self-referencing tree from hanging the request.
 *
 * Returns null rather than guessing: a product whose tree declares nothing is asked the shared
 * questions only, which still saves and still sells.
 */
export function resolveProductType(
  categoryId: string | null | undefined,
  categories: readonly ProductTypeSource[],
): string | null {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const seen = new Set<string>();
  let current = categoryId ? byId.get(categoryId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const own = parseProductTypeKey(current.productType);
    if (own) return own;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return null;
}

/** The kinds a type holds, as a picker needs them. */
export function kindsOf(type: ProductTypeRecord | null): { key: string; label: string }[] {
  return type ? [...type.kinds] : [];
}

/** Whether a kind is one this type actually holds — what a write checks before storing it. */
export function holdsKind(type: ProductTypeRecord | null, kind: string | null | undefined): boolean {
  if (!kind) return true;
  return !!type?.kinds.some((k) => k.key === kind);
}
