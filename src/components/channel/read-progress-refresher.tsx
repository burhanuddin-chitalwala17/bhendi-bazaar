"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ChannelReadDTO } from "@server/channels/channel-connection.types";
import { LISTINGS, pageReadLine } from "./listing-copy";
import { useReadProgress } from "./useReadProgress";

/**
 * The page's read line (ux.md "Partial (read running)"): while a read runs its count follows the
 * progress poll, and the page itself refreshes when there is something new to show (D10).
 */
export function ReadProgressRefresher({
  orgId,
  channel,
  label,
  read,
  hasRows,
  running,
}: {
  orgId: string;
  channel: string;
  label: string;
  read: ChannelReadDTO;
  hasRows: boolean;
  running: boolean;
}) {
  const router = useRouter();
  const { gaveUp, latest } = useReadProgress(orgId, channel, running, () => router.refresh());
  const shown = running && latest ? latest : read;
  const line = pageReadLine(shown, label, hasRows);
  if (!line) return null;
  return (
    <div className="flex flex-col gap-2">
      <p
        role={line.tone === "error" ? "alert" : "status"}
        className={cn(
          "text-sm",
          line.tone === "muted" && "text-muted-foreground",
          line.tone === "warning" && "font-medium text-warning",
          line.tone === "error" && "font-medium text-destructive",
        )}
      >
        {line.text}
      </p>
      {running && shown.total ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.round(((shown.done ?? 0) / shown.total) * 100))}%` }} />
        </div>
      ) : null}
      {gaveUp && <p className="text-sm text-muted-foreground">{LISTINGS.stillReading}</p>}
    </div>
  );
}
