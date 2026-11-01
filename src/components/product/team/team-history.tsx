"use client";

import { useState } from "react";

import type { ProductTeamEditDto } from "@server/catalog/product-team";
import { RefreshButton } from "@/components/channel/refresh-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HISTORY_SHOWN, TEAM_EDIT_COPY, TEAM_HISTORY_ANCHOR, historyLine } from "./team-edit-copy";

/** Past this many characters a line clamps behind "More" (ux Long content). */
const CLAMP_AT = 160;

export type TeamHistoryRead = { ok: true; edits: ProductTeamEditDto[] } | { ok: false };

/**
 * The team's saves on this product, newest first (product-form R12, D13). No team edits: nothing at
 * all (ux Empty); a failed read keeps its own retry rather than pretending there is no history.
 */
export function TeamHistory({ read }: { read: TeamHistoryRead }) {
  const [showAll, setShowAll] = useState(false);
  if (read.ok && read.edits.length === 0) return null;
  const edits = read.ok ? (showAll ? read.edits : read.edits.slice(0, HISTORY_SHOWN)) : [];
  return (
    <section id={TEAM_HISTORY_ANCHOR} aria-labelledby="team-history-title" className="scroll-mt-20 space-y-3 rounded-card border border-border bg-card p-4 md:p-6">
      <h2 id="team-history-title" className="font-heading text-base font-semibold">{TEAM_EDIT_COPY.title}</h2>
      {!read.ok ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{TEAM_EDIT_COPY.loadFailed}</p>
          <RefreshButton label={TEAM_EDIT_COPY.tryAgain} />
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {edits.map((edit) => <HistoryLine key={edit.id} text={historyLine(edit)} />)}
          </ul>
          {!showAll && read.edits.length > HISTORY_SHOWN && (
            <Button variant="outline" className="min-h-11" onClick={() => setShowAll(true)}>
              {TEAM_EDIT_COPY.showAll}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function HistoryLine({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > CLAMP_AT;
  return (
    <li className="text-sm text-foreground">
      <p className={long && !open ? "line-clamp-2 break-words" : "break-words"}>{text}</p>
      {long && !open && (
        <Button variant="link" className="h-auto min-h-11 px-0" onClick={() => setOpen(true)}>
          {TEAM_EDIT_COPY.more}
        </Button>
      )}
    </li>
  );
}

/** ux Loading and Slow: the history's shimmer. */
export function TeamHistorySkeleton() {
  return (
    <div id={TEAM_HISTORY_ANCHOR} className="scroll-mt-20 space-y-3 rounded-card border border-border bg-card p-4 md:p-6" aria-busy="true">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}
