"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { SheetChoicesDTO } from "@server/catalog/bulk/bulk-sheet.service";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { SHEET_COPY, useSheetDownload } from "./useSheetDownload";

/** Past this many categories the list gets a search and collapses the groups the shop doesn't sell in. */
const MANY_CATEGORIES = 60;

/** Step 1 of the bulk wizard (own-store/bulk-sheet R1, ux.md "Get the sheet"). */
export function GetTheSheet({
  orgId,
  base,
  choices,
  onDownloaded,
}: {
  orgId: string;
  /** The shop's bulk routes, or the team's for it (`productBulkBase`). */
  base: string;
  choices: SheetChoicesDTO;
  onDownloaded: () => void;
}) {
  const { ticked, toggle, download, status, slow, refused, lastDownloaded } = useSheetDownload(
    orgId,
    base,
    choices.soldIds,
    onDownloaded,
  );
  const [query, setQuery] = useState("");
  const total = choices.groups.reduce((sum, group) => sum + group.categories.length, 0);
  const many = total > MANY_CATEGORIES;
  const sold = useMemo(() => new Set(choices.soldIds), [choices.soldIds]);

  const groups = choices.groups
    .map((group) => ({
      ...group,
      categories: group.categories.filter((c) => c.path.toLowerCase().includes(query.trim().toLowerCase())),
    }))
    .filter((group) => group.categories.length > 0);
  const tabs = choices.groups.filter((group) => group.categories.some((c) => ticked.has(c.id))).map((g) => g.label);

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <section className="space-y-3 rounded-card border border-border bg-card p-4">
        <p className="text-sm font-medium">
          Which things do you sell? Tick them — your sheet gets one tab for each kind.
        </p>
        {lastDownloaded && (
          <p className="text-xs text-muted-foreground">
            Last downloaded {formatDate(lastDownloaded, { day: "numeric", month: "short" })}. Our lists change, so
            download a fresh sheet each time.
          </p>
        )}
        {!choices.hasLocation && (
          <p className="text-sm">
            Add where your stock is kept first — the sheet needs a stock column for it.{" "}
            <Link className="underline" href={`/org/${orgId}/locations`}>
              Add location
            </Link>
          </p>
        )}
        {many && (
          <Input
            type="search"
            aria-label="Search categories"
            placeholder="Search categories"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-3 md:grid-cols-2 lg:col-span-2">
          {groups.map((group) => {
            const own = group.categories.some((c) => sold.has(c.id) || ticked.has(c.id));
            return (
              <details
                key={group.label}
                open={!many || own || query.trim() !== ""}
                className="rounded-card border border-border bg-card p-3"
              >
                <summary className="cursor-pointer text-sm font-semibold">{group.label}</summary>
                <div className="mt-2 space-y-1">
                  {group.categories.map((category) => (
                    <Checkbox
                      key={category.id}
                      label={category.path}
                      checked={ticked.has(category.id)}
                      onChange={(event) => toggle(category.id, event.target.checked)}
                    />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
        <aside className="hidden space-y-2 rounded-card border border-border bg-card p-4 text-sm lg:block">
          <p className="font-semibold">Your sheet</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>Instructions</li>
            {tabs.map((tab) => (
              <li key={tab}>{tab}</li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-tabbar z-30 space-y-2 border-t border-border bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        {refused && <p className="text-sm text-destructive">{SHEET_COPY.REFUSED}</p>}
        {status === "failed" && <p className="text-sm text-destructive">{SHEET_COPY.FAILED}</p>}
        {tabs.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {tabs.length} tab{tabs.length === 1 ? "" : "s"}: {tabs.join(", ")}
          </p>
        )}
        <Button className="w-full md:w-auto" onClick={download} aria-busy={status === "making"}>
          {status === "making" && slow && <Loader2 className="animate-spin" aria-hidden />}
          {status === "making" && slow ? SHEET_COPY.MAKING : status === "failed" ? "Try again" : "Download sheet"}
        </Button>
      </div>
    </div>
  );
}
