"use client";

import { useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { DateRangeField } from "@/components/shared/forms/date-range-field";
import type { DayRange } from "@/lib/date-range";
import { Checkbox } from "@/components/ui/checkbox";
import { MEDIA_USAGE, type MediaLibraryFilters as Filters } from "@/lib/validation/schemas/media-library.schema";
import { MEDIA_TAGS } from "@server/catalog/media-library.types";
import { MEDIA_FILTERS_COPY, MEDIA_GRID_COPY } from "./media-library-copy";

export interface FilterOption {
  value: string;
  label: string;
}

interface MediaLibraryFiltersProps {
  filters: Filters;
  /** The range as the URL carries it, two day keys, so the field shows exactly what was picked. */
  range: DayRange;
  /** The kinds and sources, named by the server so this component never imports the database's enums. */
  kinds: FilterOption[];
  sources: FilterOption[];
}

const USAGE_LABELS: Record<Filters["usage"], string> = { all: MEDIA_FILTERS_COPY.usageAll, used: MEDIA_FILTERS_COPY.usageUsed, unused: MEDIA_FILTERS_COPY.usageUnused };

/**
 * The form's fields as the query string the page parses: blanks and the default usage left out.
 * The form carries no page, so a new filter starts at the first. A range handed in replaces the
 * form's own, for the moment the picker has chosen but the hidden inputs have not re-rendered.
 */
export function filterQueryFrom(form: HTMLFormElement, range?: DayRange): string {
  const query = new URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    if (range && (key === "from" || key === "to")) continue;
    if (typeof value === "string" && value !== "" && !(key === "usage" && value === "all")) query.set(key, value);
  }
  if (range?.from) query.set("from", range.from);
  if (range?.to) query.set("to", range.to);
  return query.toString();
}

/**
 * The filters live in the URL (media-library spec R6), so the page is a link anyone in the org
 * can share — but a change navigates on the client, so only the grid re-renders. A plain GET
 * form did the same job with a full page load, which read as a flicker on every pick.
 */
export function MediaLibraryFilters({ filters, range, kinds, sources }: MediaLibraryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const apply = (picked?: DayRange) => {
    if (!form.current) return;
    const query = filterQueryFrom(form.current, picked);
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  return (
    <form
      ref={form}
      method="get"
      onChange={() => apply()}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      aria-busy={isPending}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {/* First in the row (media-tags ux): what a picture is for is the usual question. */}
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">{MEDIA_FILTERS_COPY.tag}</span>
        <Select name="tag" defaultValue={filters.tag ?? ""}>
          <option value="">{MEDIA_FILTERS_COPY.allTags}</option>
          {MEDIA_TAGS.map((tag) => (
            <option key={tag} value={tag}>{MEDIA_GRID_COPY.tagLabel[tag]}</option>
          ))}
        </Select>
      </label>
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">{MEDIA_FILTERS_COPY.kind}</span>
        <Select name="kind" defaultValue={filters.kind ?? ""}>
          <option value="">{MEDIA_FILTERS_COPY.allKinds}</option>
          {kinds.map((kind) => (
            <option key={kind.value} value={kind.value}>{kind.label}</option>
          ))}
        </Select>
      </label>
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">{MEDIA_FILTERS_COPY.usage}</span>
        <Select name="usage" defaultValue={filters.usage}>
          {MEDIA_USAGE.map((usage) => (
            <option key={usage} value={usage}>{USAGE_LABELS[usage]}</option>
          ))}
        </Select>
      </label>
      <label className="flex-1 text-sm sm:max-w-44">
        <span className="mb-1 block text-muted-foreground">{MEDIA_FILTERS_COPY.source}</span>
        <Select name="source" defaultValue={filters.source ?? ""}>
          <option value="">{MEDIA_FILTERS_COPY.anySource}</option>
          {sources.map((source) => (
            <option key={source.value} value={source.value}>{source.label}</option>
          ))}
        </Select>
      </label>
      <div className="flex-1 text-sm sm:max-w-64">
        <span className="mb-1 block text-muted-foreground">{MEDIA_FILTERS_COPY.when}</span>
        <DateRangeField value={range} onChange={apply} />
      </div>
      {filters.productId && <input type="hidden" name="productId" value={filters.productId} />}
      {filters.slot && <input type="hidden" name="slot" value={filters.slot} />}
      <Checkbox name="retired" value="1" label={MEDIA_FILTERS_COPY.showRetired} defaultChecked={filters.retired} />
    </form>
  );
}
