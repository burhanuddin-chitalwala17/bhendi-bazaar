import type { FieldErrors } from "react-hook-form";
import { PRODUCT_FORM_FIELDS } from "@/lib/validation/schemas/product.schema";

/** The five steps of a new product, in order (product-form Q2, Q20). */
export const PRODUCT_STEPS = [
  { key: "photos", label: "Photos and video" },
  { key: "what", label: "What it is" },
  { key: "price", label: "Price & stock" },
  { key: "details", label: "Details" },
  { key: "review", label: "Review" },
] as const;

export type ProductStepKey = (typeof PRODUCT_STEPS)[number]["key"];
type FormField = (typeof PRODUCT_FORM_FIELDS)[number];

/**
 * Which step holds each field (TRD D1). Typed over the schema's own field list, so a field added
 * to the schema without a step is a compile error, not an error the shop cannot find.
 */
export const FIELD_STEP: Record<FormField, Exclude<ProductStepKey, "review">> = {
  media: "photos",
  name: "what",
  description: "what",
  categoryId: "what",
  tags: "what",
  flags: "what",
  familyId: "what",
  price: "price",
  salePrice: "price",
  currency: "price",
  orgId: "price",
  stockLocations: "price",
  weight: "price",
  sku: "price",
  lowStockThreshold: "price",
  kind: "details",
  brandId: "details",
  facts: "details",
  measurements: "details",
  sizes: "details",
  colors: "details",
};

/** The seldom-used fields, behind "More options" in their step (Q7). */
export const MORE_OPTIONS_FIELDS = ["sku", "lowStockThreshold", "tags", "flags", "familyId"] as const;

const META = new Set(["message", "type", "ref", "types"]);

/** One problem the shop must fix: where it sits, what it says, and which step holds it. */
export interface ProductProblem {
  path: string;
  message: string;
  step: ProductStepKey;
}

function collect(error: unknown, path: string, step: ProductStepKey, out: ProductProblem[]) {
  if (!error || typeof error !== "object") return;
  const record = error as Record<string, unknown>;
  if (typeof record.message === "string" && record.message) out.push({ path, message: record.message, step });
  for (const [key, value] of Object.entries(record)) {
    // `root` is an array's own rule (the gallery's cover); it belongs to the array's field.
    if (!META.has(key)) collect(value, key === "root" ? path : `${path}.${key}`, step, out);
  }
}

/** Every problem in the form, in step order, nested rows and facts included (D2). */
export function listProblems(errors: FieldErrors): ProductProblem[] {
  const out: ProductProblem[] = [];
  for (const [field, error] of Object.entries(errors)) {
    collect(error, field, FIELD_STEP[field as FormField] ?? "review", out);
  }
  const order = PRODUCT_STEPS.map((step) => step.key);
  return out.sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step));
}

/** How many problems each step holds, read through the one map. */
export function errorCountsByStep(errors: FieldErrors): Record<ProductStepKey, number> {
  const counts: Record<ProductStepKey, number> = { photos: 0, what: 0, price: 0, details: 0, review: 0 };
  for (const problem of listProblems(errors)) counts[problem.step] += 1;
  return counts;
}

/** The first step, in order, that holds a problem; null when there is none. */
export function firstStepWithError(errors: FieldErrors): ProductStepKey | null {
  return listProblems(errors)[0]?.step ?? null;
}

/** "1 thing to fix" / "2 things to fix" (ux.md copy deck). */
export function thingsToFix(count: number): string {
  return `${count} ${count === 1 ? "thing" : "things"} to fix`;
}

/** Each field as the shop reads it, for "your changes to …" (product-form D8, D10). Typed like FIELD_STEP. */
export const FIELD_LABEL: Record<FormField, string> = {
  media: "Photos and video",
  name: "Name",
  description: "Description",
  categoryId: "Category",
  tags: "Tags",
  flags: "Flags",
  familyId: "Family",
  price: "Price",
  salePrice: "Sale price",
  currency: "Currency",
  orgId: "Shop",
  stockLocations: "Stock",
  weight: "Packed weight",
  sku: "SKU",
  lowStockThreshold: "Low-stock alert",
  kind: "Kind",
  brandId: "Brand",
  facts: "Details",
  measurements: "Measurements",
  sizes: "Sizes",
  colors: "Colours",
};

/** The form's own fields among some top-level keys, in schema order (a dirty map, a set of re-applied fields). */
export function formFieldsIn(keys: Iterable<string>): FormField[] {
  const present = new Set(keys);
  return PRODUCT_FORM_FIELDS.filter((field) => present.has(field));
}

/** The steps holding these fields, in step order, each once. */
export function stepsOf(fields: readonly FormField[]): Exclude<ProductStepKey, "review">[] {
  const held = new Set(fields.map((field) => FIELD_STEP[field]));
  return PRODUCT_STEPS.map((step) => step.key).filter((key): key is Exclude<ProductStepKey, "review"> => held.has(key as never));
}

/** "Price & stock", "Price & stock and Details", "Photos and video, Price & stock and Details". */
export function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** The leave sheet's body (ux copy deck): which sections hold the changes that would be lost. */
export function leaveBody(steps: readonly ProductStepKey[]): string {
  const labels = steps.map((key) => PRODUCT_STEPS.find((step) => step.key === key)?.label ?? key);
  return `Your changes to ${labels.length ? joinWords(labels) : "this product"} will be lost.`;
}
