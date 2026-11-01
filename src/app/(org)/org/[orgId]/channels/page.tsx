import { requireOrgMember } from "@/lib/org-auth";
import { channelsDAL } from "@/data-access-layer/channels.dal";
import { PageHeader } from "@/components/shared/page-shell";
import { ChannelCardList } from "@/components/channel/channel-card-list";
import { ConnectResultNote } from "@/components/channel/connect-result-note";
import { PAGE_INTRO } from "@/components/channel/channel-copy";
import { isConnectResult, isMarketplaceChannel } from "@server/channels/channel-connection.types";
import { CHANNEL_LABELS } from "@server/shared/channels";

export const metadata = {
  title: "Channels",
  robots: { index: false, follow: false },
};

/** Where the shop sells: what it has connected (channel-connectors spec R8, ux.md). */
export default async function OrgChannelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ result?: string; channel?: string }>;
}) {
  const { orgId } = await params;
  const { result, channel } = await searchParams;
  const scope = await requireOrgMember(orgId);
  const { overview, storePath, storeLabel } = await channelsDAL.page(scope.orgId);
  const outcome =
    result && channel && isConnectResult(result) && isMarketplaceChannel(channel) ? { result, channel } : null;

  return (
    <div className="space-y-6">
      <PageHeader help="channels" title="Channels" description={PAGE_INTRO} />
      {outcome && (
        <ConnectResultNote
          orgId={scope.orgId}
          channel={outcome.channel}
          label={CHANNEL_LABELS[outcome.channel]}
          result={outcome.result}
        />
      )}
      <ChannelCardList orgId={scope.orgId} cards={overview.cards} storePath={storePath} storeLabel={storeLabel} />
    </div>
  );
}
