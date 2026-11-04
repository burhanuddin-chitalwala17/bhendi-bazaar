"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsivePicker } from "@/components/shared/overlays/responsive-picker";
import { FormField } from "../FormField";

interface CategoryOption {
  id: string;
  name: string;
  parentId?: string | null;
}

const RECENT_KEY = "product-form-recent-categories";
const RECENT_LIMIT = 4;

/** Storage can be absent or refuse (private window); recent picks are a convenience, never state. */
function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    // Nothing to do: the next pick simply is not remembered.
  }
}

/** "Clothing › Abaya": the path a shop recognises, since two leaves may share a name. */
function pathOf(category: CategoryOption, byId: Map<string, CategoryOption>): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let node: CategoryOption | undefined = category;
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    names.unshift(node.name);
    node = node.parentId ? byId.get(node.parentId) : undefined;
  }
  return names.join(" › ");
}

/** The category, chosen from a searchable sheet with recent picks first (product-form ux "Many items"). */
export function CategoryPicker({
  value,
  onChange,
  categories,
  error,
  id,
}: {
  value: string;
  onChange: (id: string) => void;
  categories: CategoryOption[];
  error?: string;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(() => (typeof window === "undefined" ? [] : readRecent()));

  const byId = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const options = useMemo(
    () => categories.map((category) => ({ id: category.id, path: pathOf(category, byId) })),
    [byId, categories],
  );
  const needle = query.trim().toLowerCase();
  const matches = needle ? options.filter((option) => option.path.toLowerCase().includes(needle)) : options;
  const recentOptions = needle
    ? []
    : recent.map((rid) => options.find((option) => option.id === rid)).filter((option) => !!option);
  const selected = options.find((option) => option.id === value);

  const choose = (choice: string) => {
    onChange(choice);
    const next = [choice, ...recent.filter((rid) => rid !== choice)].slice(0, RECENT_LIMIT);
    setRecent(next);
    writeRecent(next);
    setOpen(false);
    setQuery("");
  };

  const row = (option: { id: string; path: string }) => (
    <Button
      key={option.id}
      type="button"
      variant={option.id === value ? "secondary" : "ghost"}
      className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left"
      onClick={() => choose(option.id)}
    >
      {option.path}
    </Button>
  );

  return (
    <FormField id={id} label="Category" required error={error}>
      <ResponsivePicker
        open={open}
        onOpenChange={setOpen}
        title="Category"
        className="w-80"
        trigger={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={!!error}
            className="h-auto min-h-10 w-full justify-between whitespace-normal py-2 text-left"
          >
            <span className={selected ? "text-foreground" : "text-muted-foreground"}>
              {selected?.path ?? "Pick a category"}
            </span>
            <Icon name="expand" />
          </Button>
        }
      >
        <div className="relative">
          <Icon name="search" tone="muted" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search categories"
            aria-label="Search categories"
            className="pl-9"
          />
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {recentOptions.length > 0 && (
            <>
              <p className="px-1 pt-1 text-xs text-muted-foreground">Recent</p>
              {recentOptions.map(row)}
              <p className="px-1 pt-2 text-xs text-muted-foreground">All categories</p>
            </>
          )}
          {matches.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">No category matches &ldquo;{query.trim()}&rdquo;</p>
          ) : (
            matches.map(row)
          )}
        </div>
      </ResponsivePicker>
    </FormField>
  );
}
