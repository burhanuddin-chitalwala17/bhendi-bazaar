import { z } from "zod";

/**
 * The named photo slots a product's gallery fills (media-library R4, D4).
 *
 * A slot's `role` decides which checks a photo gets at upload (D6): a product shot is judged
 * for darkness, blur and size; the label is read, not judged; a lifestyle shot is the org's
 * creative choice and is checked for size only. Pure and Prisma-free so the editor and the
 * server resolve a category's list with the same function.
 */
export const SHOT_ROLE = { PRODUCT: "product", LABEL: "label", LIFESTYLE: "lifestyle" } as const;
export const SHOT_ROLES = [SHOT_ROLE.PRODUCT, SHOT_ROLE.LABEL, SHOT_ROLE.LIFESTYLE] as const;
export type ShotRole = (typeof SHOT_ROLES)[number];

export const shotSlotSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{0,39}$/, "A slot key is lowercase letters, digits and hyphens"),
  label: z.string().trim().min(1).max(40),
  hint: z.string().trim().max(200).optional(),
  role: z.enum(SHOT_ROLES),
});

export const shotListSchema = z
  .array(shotSlotSchema)
  .min(1, "A shot list needs at least one slot")
  .max(12, "A shot list has at most twelve slots")
  .refine((list) => new Set(list.map((slot) => slot.key)).size === list.length, {
    message: "Slot keys must be unique within a list",
  });

export type ShotSlot = z.infer<typeof shotSlotSchema>;
export type ShotList = ShotSlot[];

/** Every category starts here (spec R4); a category's own list replaces it, never extends it. */
export const DEFAULT_SHOT_LIST: ShotList = [
  { key: "front", label: "Front", hint: "The product centred, filling most of the frame, on a plain background", role: "product" },
  { key: "back", label: "Back", hint: "The reverse, same framing as the front", role: "product" },
  { key: "detail", label: "Detail", hint: "Close on the texture, stitching or finish", role: "product" },
  { key: "label", label: "Label", hint: "The pack or tag label, flat and readable", role: "label" },
  { key: "scale", label: "Scale", hint: "Beside a familiar object, or in the hand", role: "product" },
];

/** A stored list, or null when there is none or it does not parse — a category then inherits. */
export function parseShotList(value: unknown): ShotList | null {
  if (value === null || value === undefined) return null;
  const parsed = shotListSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export interface ShotListSource {
  id: string;
  parentId?: string | null;
  shotList?: unknown;
}

/**
 * The list a category's products fill: its own, else the nearest ancestor's, else the default
 * (D4). Works on any category shape that carries `parentId` and `shotList`, so a page and a
 * service resolve identically.
 */
export function resolveShotList(
  categoryId: string | null | undefined,
  categories: readonly ShotListSource[],
): ShotList {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const seen = new Set<string>();
  let current = categoryId ? byId.get(categoryId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const own = parseShotList(current.shotList);
    if (own) return own;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return DEFAULT_SHOT_LIST;
}

/** The slot keys in `used` that `list` does not declare — what the boundary refuses (D4). */
export function unknownSlots(
  used: readonly (string | null | undefined)[],
  list: ShotList,
): string[] {
  const allowed = new Set(list.map((slot) => slot.key));
  return used.filter((slot): slot is string => !!slot && !allowed.has(slot));
}
