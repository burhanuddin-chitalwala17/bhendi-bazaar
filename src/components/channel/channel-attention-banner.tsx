import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CARD_STATE, type ChannelAttentionDTO } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { ACTION, BANNER } from "./channel-copy";

/** One banner on the dashboard for a connection that needs the shop (spec R9, ux.md). */
export function ChannelAttentionBanner({ orgId, attention }: { orgId: string; attention: ChannelAttentionDTO[] }) {
  if (attention.length === 0) return null;

  if (attention.length > 1) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-card border border-warning bg-warning/10 p-3 text-sm md:flex-row md:items-center md:justify-between">
        <p>{BANNER.several(attention.length)}</p>
        <Button asChild variant="outline" size="sm" className="min-h-10 self-start md:self-auto">
          <Link href={`/org/${orgId}/channels`}>{BANNER.openChannels}</Link>
        </Button>
      </div>
    );
  }

  const [item] = attention;
  const renewal = item.state === CARD_STATE.RENEWAL_DUE;
  return (
    <div
      role="status"
      className={
        renewal
          ? "flex flex-col gap-2 rounded-card border border-warning bg-warning/10 p-3 text-sm md:flex-row md:items-center md:justify-between"
          : "flex flex-col gap-2 rounded-card border border-destructive bg-destructive/10 p-3 text-sm md:flex-row md:items-center md:justify-between"
      }
    >
      <p>{renewal && item.reapproveBy ? BANNER.renewalDue(item.label, item.reapproveBy) : BANNER.needsReconnect(item.label)}</p>
      <Button asChild size="sm" className="min-h-10 self-start md:self-auto">
        <a href={channelsApiClient.connectUrl(orgId, item.channel)}>{renewal ? ACTION.renewNow : ACTION.reconnect}</a>
      </Button>
    </div>
  );
}
