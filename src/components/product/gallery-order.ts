import type { ProductMediaInput } from "@server/catalog/media";
import type { ShotList } from "@server/catalog/shot-list";

/**
 * The gallery's order and its slot bookkeeping, as pure functions (media-library D4).
 *
 * `position` is the array index on write, and a buyer's gallery follows it, so the editor keeps
 * the array in the order it shows: the filled slots in shot-list order, then the extras in the
 * order the org member arranged them. Items are keyed by `ref` — a URL or a video id — which the
 * editor keeps unique. None of these changes the set of items, only their order and slots.
 */

type GalleryItem = Pick<ProductMediaInput, "kind" | "ref" | "slot">;

/** The photograph filling each declared slot, and everything else in its own order. */
export function splitGallery<T extends GalleryItem>(
  media: readonly T[],
  shotList: ShotList,
): { filled: Map<string, T>; extras: T[] } {
  const declared = new Set(shotList.map((slot) => slot.key));
  const filled = new Map<string, T>();
  const extras: T[] = [];
  for (const item of media) {
    // Only a photograph fills a slot, and a slot holds one; a second claimant, or a key the
    // category does not declare, is an extra until the editor's effect clears it.
    if (item.kind === "IMAGE" && item.slot && declared.has(item.slot) && !filled.has(item.slot)) {
      filled.set(item.slot, item);
    } else {
      extras.push(item);
    }
  }
  return { filled, extras };
}

export function orderGallery<T extends GalleryItem>(media: readonly T[], shotList: ShotList): T[] {
  const { filled, extras } = splitGallery(media, shotList);
  const slotted = shotList.flatMap((slot) => {
    const item = filled.get(slot.key);
    return item ? [item] : [];
  });
  return [...slotted, ...extras];
}

/** One photograph per slot: assigning it here takes it from whichever item held it. */
export function assignSlotTo<T extends GalleryItem>(media: readonly T[], ref: string, slotKey: string): T[] {
  if (!slotKey) return clearSlot(media, ref);
  return media.map((item) => {
    if (item.ref === ref) return { ...item, slot: slotKey };
    return item.slot === slotKey ? { ...item, slot: null } : item;
  });
}

/** "Move to extra": the photograph keeps everything but its slot. */
export function clearSlot<T extends GalleryItem>(media: readonly T[], ref: string): T[] {
  return media.map((item) => (item.ref === ref ? { ...item, slot: null } : item));
}

/** Reordering is an extras-only affair: the slots' order is the category's. */
export function moveExtra<T extends GalleryItem>(
  media: readonly T[],
  ref: string,
  delta: 1 | -1,
  shotList: ShotList,
): T[] {
  const { filled, extras } = splitGallery(media, shotList);
  const index = extras.findIndex((item) => item.ref === ref);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= extras.length) return orderGallery(media, shotList);
  const next = [...extras];
  [next[index], next[target]] = [next[target], next[index]];
  const slotted = shotList.flatMap((slot) => {
    const item = filled.get(slot.key);
    return item ? [item] : [];
  });
  return [...slotted, ...next];
}
