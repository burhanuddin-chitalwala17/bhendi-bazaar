"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SheetChoicesDTO } from "@server/catalog/bulk/bulk-sheet.service";
import { Button } from "@/components/ui/button";
import { ActionBar } from "@/components/shared/action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { SHEET_COPY, useSheetDownload } from "./useSheetDownload";
import { GET_THE_SHEET_COPY } from "./bulk-copy";
import { ROUTES } from "@server/shared/routes";

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
          {GET_THE_SHEET_COPY.intro}
        </p>
        {lastDownloaded && (
          <p className="text-xs text-muted-foreground">
            {GET_THE_SHEET_COPY.lastDownloaded(formatDate(lastDownloaded, { day: "numeric", month: "short" }))}
          </p>
        )}
        {!choices.hasLocation && (
          <p className="text-sm">
            {GET_THE_SHEET_COPY.noLocation}{" "}
            <Link className="underline" href={ROUTES.org.locations(orgId)}>
              {GET_THE_SHEET_COPY.addLocation}
            </Link>
          </p>
        )}
        {many && (
          <Input
            type="search"
            aria-label={GET_THE_SHEET_COPY.search}
            placeholder={GET_THE_SHEET_COPY.search}
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
          <p className="font-semibold">{GET_THE_SHEET_COPY.yourSheet}</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>{GET_THE_SHEET_COPY.instructions}</li>
            {tabs.map((tab) => (
              <li key={tab}>{tab}</li>
            ))}
          </ul>
        </aside>
      </div>

      <ActionBar
        className="-mx-4 md:mx-0"
        status={
          refused || status === "failed" || tabs.length > 0 ? (
            <>
              {refused && <p className="text-destructive">{SHEET_COPY.REFUSED}</p>}
              {status === "failed" && <p className="text-destructive">{SHEET_COPY.FAILED}</p>}
              {tabs.length > 0 && (
                <p>
                  {GET_THE_SHEET_COPY.tabs(tabs.length, tabs.join(", "))}
                </p>
              )}
            </>
          ) : null
        }
      >
        <Button className="w-full md:w-auto" onClick={download} pending={status === "making"}>
          {status === "making" && slow ? SHEET_COPY.MAKING : status === "failed" ? GET_THE_SHEET_COPY.tryAgain : GET_THE_SHEET_COPY.download}
        </Button>
      </ActionBar>
    </div>
  );
}
