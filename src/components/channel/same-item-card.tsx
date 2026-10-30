"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { GROUP } from "./family-copy";
import { ROW } from "./listing-copy";

/** "Looks like one item" (family-merge ux.md, Q5, Q21): a suggestion, never a grouping by itself. */
export function SameItemCard({
  orgId,
  channel,
  listingIds,
  titles,
}: {
  orgId: string;
  channel: MarketplaceChannel;
  listingIds: string[];
  titles: string[];
}) {
  const router = useRouter();
  const dismiss = useMutation(() => channelsApiClient.dismissGroup(orgId, channel, listingIds), {
    showToast: false,
    onSuccess: () => router.refresh(),
    onError: () => toast.error(ROW.failed),
  });
  return (
    <div className="flex flex-col gap-2 rounded-card border border-warning bg-warning/10 p-4">
      <strong className="text-sm">{GROUP.looksLikeOne(listingIds.length)}</strong>
      <p className="text-sm text-muted-foreground">{titles.join(" · ")}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="min-h-10">
          <Link href={`/org/${orgId}/channels/family?listings=${listingIds.join(",")}`}>{GROUP.groupThem}</Link>
        </Button>
        <Button variant="outline" size="sm" className="min-h-10" aria-busy={dismiss.isLoading} onClick={() => void dismiss.mutate().catch(() => undefined)}>
          {GROUP.notOneItem}
        </Button>
      </div>
    </div>
  );
}
