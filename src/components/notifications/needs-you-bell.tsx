"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { HANDOFF_WIDE, HandoffSheet } from "@/components/shared/overlays/handoff-sheet";
import { NOTIFICATION_KIND, type NeedsYouRow, type NotificationKind } from "@server/notifications/notification.types";
import { NOTIFICATIONS_UI_COPY } from "./notifications-copy";
import { useNeedsYou } from "./useNeedsYou";

const COPY = NOTIFICATIONS_UI_COPY.bell;

const KIND_ICON: Record<NotificationKind, IconName> = {
  [NOTIFICATION_KIND.CONVERSATION_WAITING]: "message",
  [NOTIFICATION_KIND.POST_FAILED]: "warning",
  [NOTIFICATION_KIND.CONNECTION_NEEDS_YOU]: "connect",
  [NOTIFICATION_KIND.POST_HELD]: "info",
  [NOTIFICATION_KIND.POST_DUE]: "photo",
};

const when = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
function ago(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return when.format(minutes, "minute");
  if (Math.abs(minutes) < 60 * 24) return when.format(Math.round(minutes / 60), "hour");
  return when.format(Math.round(minutes / (60 * 24)), "day");
}

/**
 * The portal header's bell and its Needs you sheet (notifications-core ux.md): the count comes with the
 * page; the list is read when opened. A bottom sheet on a phone and tablet, a popover from `lg:`.
 */
export function NeedsYouBell({ orgId, initialCount }: { orgId: string; initialCount: number }) {
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useNeedsYou(orgId, open);
  const count = data?.count ?? initialCount;

  const trigger = (
    <Button variant="ghost" shape="icon" size="lg" className="relative" aria-label={COPY.label(count)}>
      <Icon name="notifications" size="md" />
      {count > 0 && <Badge className="absolute -right-0.5 -top-0.5 min-w-5 px-1">{count}</Badge>}
    </Button>
  );

  return (
    <HandoffSheet open={open} onOpenChange={setOpen} trigger={trigger} title={COPY.title} closeLabel={COPY.close} wide={HANDOFF_WIDE.POPOVER}>
      {loading && !data ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : error && !data ? (
        <p className="text-small text-muted-foreground">{COPY.failed}</p>
      ) : !data || data.rows.length === 0 ? (
        <p className="text-small text-muted-foreground">{COPY.empty}</p>
      ) : (
        <ul className="max-h-96 space-y-1 overflow-y-auto">
          {data.rows.map((row) => (
            <NeedsYouItem key={row.key} row={row} onOpen={() => setOpen(false)} />
          ))}
        </ul>
      )}
    </HandoffSheet>
  );
}

function NeedsYouItem({ row, onOpen }: { row: NeedsYouRow; onOpen: () => void }) {
  return (
    <li>
      <Button asChild variant="ghost" className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal px-2 py-2 text-left">
        <Link href={row.href} onClick={onOpen}>
          <Icon name={KIND_ICON[row.kind]} size="sm" tone="muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-small font-medium text-foreground">{row.title}</span>
            <span className="block text-caption text-muted-foreground">{ago(row.at)}</span>
          </span>
        </Link>
      </Button>
    </li>
  );
}
