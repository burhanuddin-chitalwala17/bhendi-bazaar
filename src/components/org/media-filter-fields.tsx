"use client";

import { Select } from "@/components/ui/select";
import { DateRangeField } from "@/components/shared/forms/date-range-field";
import { MEDIA_USAGE } from "@/lib/validation/schemas/media-library.schema";
import { MEDIA_TAGS } from "@server/catalog/media-library.types";
import type { MediaFilterValue } from "@/lib/media/filter-value";
import { MEDIA_FILTERS_COPY, MEDIA_GRID_COPY } from "./media-library-copy";

export interface FilterOption {
  value: string;
  label: string;
}

export type MediaFilterField = "tag" | "kind" | "usage" | "source" | "when";

interface MediaFilterFieldsProps<V extends Partial<MediaFilterValue>> {
  value: V;
  onChange: (next: V) => void;
  kinds: readonly FilterOption[];
  sources: readonly FilterOption[];
  /** Fields the host does not offer: the picker's tabs are its kind, and a video takes no tag. */
  omit?: readonly MediaFilterField[];
  /** Classes for each field's wrapper, so each host lays the row out its own way. */
  fieldClassName?: string;
  /** The range names its days, so a host may give it more room than a select. */
  whenClassName?: string;
}

const USAGE_LABELS: Record<MediaFilterValue["usage"], string> = {
  all: MEDIA_FILTERS_COPY.usageAll,
  used: MEDIA_FILTERS_COPY.usageUsed,
  unused: MEDIA_FILTERS_COPY.usageUnused,
};

const usageOf = (raw: string) => MEDIA_USAGE.find((usage) => usage === raw) ?? "all";

/**
 * The library's filter fields, controlled, shared by the Library page and the picker so their
 * words and choices cannot drift (picker-filters D1). Each select keeps its `name`, which is how
 * the page's form reads them into its URL.
 */
export function MediaFilterFields<V extends Partial<MediaFilterValue>>({
  value,
  onChange,
  kinds,
  sources,
  omit = [],
  fieldClassName = "flex-1 text-sm",
  whenClassName = fieldClassName,
}: MediaFilterFieldsProps<V>) {
  const shows = (field: MediaFilterField) => !omit.includes(field);
  const set = (patch: Partial<MediaFilterValue>) => onChange({ ...value, ...patch });

  return (
    <>
      {/* First in the row (media-tags ux): what a picture is for is the usual question. */}
      {shows("tag") && (
        <label className={fieldClassName}>
          <span className="mb-1 block text-muted-foreground">{MEDIA_FILTERS_COPY.tag}</span>
          <Select name="tag" value={value.tag ?? ""} onChange={(event) => set({ tag: event.target.value })}>
            <option value="">{MEDIA_FILTERS_COPY.allTags}</option>
            {MEDIA_TAGS.map((tag) => (
              <option key={tag} value={tag}>{MEDIA_GRID_COPY.tagLabel[tag]}</option>
            ))}
          </Select>
        </label>
      )}
      {shows("kind") && (
        <label className={fieldClassName}>
          <span className="mb-1 block text-muted-foreground">{MEDIA_FILTERS_COPY.kind}</span>
          <Select name="kind" value={value.kind ?? ""} onChange={(event) => set({ kind: event.target.value })}>
            <option value="">{MEDIA_FILTERS_COPY.allKinds}</option>
            {kinds.map((kind) => (
              <option key={kind.value} value={kind.value}>{kind.label}</option>
            ))}
          </Select>
        </label>
      )}
      {shows("usage") && (
        <label className={fieldClassName}>
          <span className="mb-1 block text-muted-foreground">{MEDIA_FILTERS_COPY.usage}</span>
          <Select name="usage" value={value.usage ?? "all"} onChange={(event) => set({ usage: usageOf(event.target.value) })}>
            {MEDIA_USAGE.map((usage) => (
              <option key={usage} value={usage}>{USAGE_LABELS[usage]}</option>
            ))}
          </Select>
        </label>
      )}
      {shows("source") && (
        <label className={fieldClassName}>
          <span className="mb-1 block text-muted-foreground">{MEDIA_FILTERS_COPY.source}</span>
          <Select name="source" value={value.source ?? ""} onChange={(event) => set({ source: event.target.value })}>
            <option value="">{MEDIA_FILTERS_COPY.anySource}</option>
            {sources.map((source) => (
              <option key={source.value} value={source.value}>{source.label}</option>
            ))}
          </Select>
        </label>
      )}
      {shows("when") && (
        <div className={whenClassName}>
          <span className="mb-1 block text-muted-foreground">{MEDIA_FILTERS_COPY.when}</span>
          <DateRangeField value={{ from: value.from, to: value.to }} onChange={(range) => set({ from: range.from, to: range.to })} />
        </div>
      )}
    </>
  );
}
