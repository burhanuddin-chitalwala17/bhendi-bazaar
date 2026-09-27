"use client";

import { useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MEDIA_USAGE, type MediaLibraryFilters as Filters } from "@/lib/validation/schemas/media-library.schema";

export interface FilterOption {
  value: string;
  label: string;
}

interface MediaLibraryFiltersProps {
  filters: Filters;
  /** The kinds and sources, named by the server so this component never imports the database's enums. */
  kinds: FilterOption[];
  sources: FilterOption[];
}

const USAGE_LABELS: Record<Filters["usage"], string> = { all: "Used or not", used: "In use", unused: "Not used" };

const toDateInput = (value: Date | undefined) => (value ? value.toISOString().slice(0, 10) : "");

/** The form's fields as the query string the page parses: blanks and the default usage left out. The form carries no page, so a new filter starts at the first. */
export function filterQueryFrom(form: HTMLFormElement): string {
  const query = new URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    if (typeof value === "string" && value !== "" && !(key === "usage" && value === "all")) query.set(key, value);
  }
  return query.toString();
}

/**
 * The filters live in the URL (media-library spec R6), so the page is a link anyone in the org
 * can share — but a change navigates on the client, so only the grid re-renders. A plain GET
 * form did the same job with a full page load, which read as a flicker on every pick.
 */
export function MediaLibraryFilters({ filters, kinds, sources }: MediaLibraryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const apply = () => {
    if (!form.current) return;
    const query = filterQueryFrom(form.current);
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  return (
    <form
      ref={form}
      method="get"
      onChange={apply}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      aria-busy={isPending}
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">Kind</span>
        <Select name="kind" defaultValue={filters.kind ?? ""}>
          <option value="">Photos and videos</option>
          {kinds.map((kind) => (
            <option key={kind.value} value={kind.value}>{kind.label}</option>
          ))}
        </Select>
      </label>
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">Usage</span>
        <Select name="usage" defaultValue={filters.usage}>
          {MEDIA_USAGE.map((usage) => (
            <option key={usage} value={usage}>{USAGE_LABELS[usage]}</option>
          ))}
        </Select>
      </label>
      <label className="flex-1 text-sm sm:max-w-44">
        <span className="mb-1 block text-muted-foreground">Came from</span>
        <Select name="source" defaultValue={filters.source ?? ""}>
          <option value="">Anywhere</option>
          {sources.map((source) => (
            <option key={source.value} value={source.value}>{source.label}</option>
          ))}
        </Select>
      </label>
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">From</span>
        <Input type="date" name="from" defaultValue={toDateInput(filters.from)} />
      </label>
      <label className="flex-1 text-sm sm:max-w-40">
        <span className="mb-1 block text-muted-foreground">To</span>
        <Input type="date" name="to" defaultValue={toDateInput(filters.to)} />
      </label>
      {filters.productId && <input type="hidden" name="productId" value={filters.productId} />}
      {filters.slot && <input type="hidden" name="slot" value={filters.slot} />}
      <Checkbox name="retired" value="1" label="Show retired" defaultChecked={filters.retired} />
    </form>
  );
}
