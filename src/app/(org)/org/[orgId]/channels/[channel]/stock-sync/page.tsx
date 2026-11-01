import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/org-auth";
import { channelStockDAL } from "@/data-access-layer/channel-stock.dal";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { PageShell } from "@/components/shared/page-shell";
import { StockPreview } from "@/components/channel/stock-preview";
import { PREVIEW } from "@/components/channel/stock-copy";

export const metadata = {
  title: "Turn on stock sync",
  robots: { index: false, follow: false },
};

/** What turning stock sync on will change, read live; nothing is sent until confirmed (inventory-sync Q4). */
export default async function StockSyncPreviewPage({ params }: { params: Promise<{ orgId: string; channel: string }> }) {
  const { orgId, channel } = await params;
  const scope = await requireOrgMember(orgId);
  const preview = await channelStockDAL.preview(scope.orgId, channel);
  if (!preview) notFound();
  return (
    <PageShell width="narrow">
      <SectionHeader as="h1" help="channels" title={PREVIEW.title} description={PREVIEW.subtitle(preview.label)} />
      <StockPreview orgId={scope.orgId} preview={preview} backHref={`/org/${scope.orgId}/channels/${preview.channel}/listings`} />
    </PageShell>
  );
}
