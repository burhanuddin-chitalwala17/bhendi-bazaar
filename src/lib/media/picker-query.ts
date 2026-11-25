import type { MediaAssetDto } from "@server/catalog/media-library.types";
import type { MediaFilterValue } from "./filter-value";

/** The picker's filters: its tabs are the kind, and it has no "Show retired" (picker-filters Q3). */
export type PickerFilters = Omit<MediaFilterValue, "kind">;

type Kind = MediaAssetDto["kind"];

export const NO_PICKER_FILTERS: PickerFilters = { tag: "", usage: "all", source: "" };

/** Only photographs carry tags (media-tags D1); elsewhere a chosen tag is kept but ignored (Q6). */
export const tagAppliesTo = (kind: Kind) => kind === "IMAGE";

/**
 * Where each kind can come from (Q7): a photo or video is uploaded or made from another; a YouTube
 * item is only ever a link. A source that cannot occur on a tab is not offered there.
 */
const SOURCES_BY_KIND: Record<Kind, readonly MediaAssetDto["source"][]> = {
  IMAGE: ["UPLOAD", "DERIVED"],
  VIDEO: ["UPLOAD", "DERIVED"],
  VIDEO_EMBED: [],
};

export const sourcesFor = (kind: Kind): readonly string[] => SOURCES_BY_KIND[kind];
const sourceApplies = (kind: Kind, source: string) => sourcesFor(kind).includes(source);

/** The query `useMediaLibraryPages` sends for one tab (trd D4). `retired` is never read, so never sent. */
export function pickerQuery(kind: Kind, filters: PickerFilters): string {
  const query = new URLSearchParams({ kind });
  if (filters.tag && tagAppliesTo(kind)) query.set("tag", filters.tag);
  if (filters.usage !== "all") query.set("usage", filters.usage);
  if (filters.source && sourceApplies(kind, filters.source)) query.set("source", filters.source);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  return query.toString();
}

/** The count on the Filters button: what applies to the tab in view, a range counting once (trd D5). */
export function activePickerFilterCount(kind: Kind, filters: PickerFilters): number {
  return [filters.tag && tagAppliesTo(kind), filters.usage !== "all", filters.source && sourceApplies(kind, filters.source), filters.from || filters.to].filter(Boolean).length;
}

export const hasPickerFilters = (kind: Kind, filters: PickerFilters) => activePickerFilterCount(kind, filters) > 0;
