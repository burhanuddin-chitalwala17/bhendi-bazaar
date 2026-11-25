"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { DayRange } from "@/lib/date-range";
import { Checkbox } from "@/components/ui/checkbox";
import type { MediaLibraryFilters as Filters } from "@/lib/validation/schemas/media-library.schema";
import type { MediaFilterValue } from "@/lib/media/filter-value";
import { MediaFilterFields, type FilterOption } from "./media-filter-fields";
import { MEDIA_FILTERS_COPY } from "./media-library-copy";

interface MediaLibraryFiltersProps {
  filters: Filters;
  /** The range as the URL carries it, two day keys, so the field shows exactly what was picked. */
  range: DayRange;
  /** The kinds and sources, named in the copy module (picker-filters D2). */
  kinds: FilterOption[];
  sources: FilterOption[];
}

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

const valueFrom = (filters: Filters, range: DayRange): MediaFilterValue => ({
  tag: filters.tag ?? "",
  kind: filters.kind ?? "",
  usage: filters.usage,
  source: filters.source ?? "",
  from: range.from,
  to: range.to,
});

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
  // Re-seeded whenever the URL moves under it (Back, a sidebar link), so the fields never show a stale filter.
  const seed = valueFrom(filters, range);
  const seedKey = JSON.stringify(seed);
  const [seededFrom, setSeededFrom] = useState(seedKey);
  const [value, setValue] = useState<MediaFilterValue>(seed);
  if (seededFrom !== seedKey) {
    setSeededFrom(seedKey);
    setValue(seed);
  }

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
      {/* A select's change bubbles to the form; a picked range fires none, so it applies here. */}
      <MediaFilterFields
        value={value}
        onChange={(next) => {
          setValue(next);
          if (next.from !== value.from || next.to !== value.to) apply({ from: next.from, to: next.to });
        }}
        kinds={kinds}
        sources={sources}
        fieldClassName="flex-1 text-sm sm:max-w-40"
        whenClassName="flex-1 text-sm sm:max-w-64"
      />
      {filters.productId && <input type="hidden" name="productId" value={filters.productId} />}
      {filters.slot && <input type="hidden" name="slot" value={filters.slot} />}
      <Checkbox name="retired" value="1" label={MEDIA_FILTERS_COPY.showRetired} defaultChecked={filters.retired} />
    </form>
  );
}
