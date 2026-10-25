import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/org-auth";
import { channelSettleDAL } from "@/data-access-layer/channel-settle.dal";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { PageShell } from "@/components/shared/page-shell";
import { RefreshButton } from "@/components/channel/refresh-button";
import { SettleForm } from "@/components/channel/settle-form";
import { SETTLE, SETTLE_ACTION } from "@/components/channel/settle-copy";
import { ago } from "@/components/channel/listing-copy";

export const metadata = {
  title: "Settle listing",
  robots: { index: false, follow: false },
};

const STALE_MS = 2 * 24 * 60 * 60_000;

/** Add a marketplace listing as a new product, or match it to one (product-merge spec R3–R6, ux.md). */
export default async function SettleListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  /** `productId`, not `product`: the edge firewall refuses any `product=` or `p=` query (2026-10-23). */
  searchParams: Promise<{ listing?: string; productId?: string }>;
}) {
  const { orgId } = await params;
  const { listing, productId } = await searchParams;
  if (!listing) notFound();
  const scope = await requireOrgMember(orgId);
  const data = await channelSettleDAL.page(scope.orgId, listing, productId ?? null);
  if (!data) notFound();
  const { detail } = data;
  const backHref = `/org/${scope.orgId}/channels/${detail.primary.channel}/listings?tab=notLinked`;
  const stale = detail.readFinishedAt && Date.now() - new Date(detail.readFinishedAt).getTime() > STALE_MS;

  return (
    <PageShell width="narrow">
      <SectionHeader
        as="h1"
        title={detail.product ? SETTLE.titleMatch(detail.product.name) : SETTLE.titleNew}
        description={[detail.primary.label, detail.primary.sku].join(" · ")}
      />
      {stale && detail.readFinishedAt && (
        <p className="text-sm font-medium text-warning">{SETTLE.stale(detail.primary.label, ago(detail.readFinishedAt, Date.now()))}</p>
      )}
      {detail.primary.readFailed && (
        <div role="alert" className="flex flex-col gap-2 rounded-card border border-warning bg-warning/10 p-3 text-sm">
          <p>{SETTLE.readFailed(detail.primary.label)}</p>
          <RefreshButton label={SETTLE_ACTION.tryAgain} />
        </div>
      )}
      <SettleForm orgId={scope.orgId} shopName={data.shopName} orgCode={data.orgCode} detail={detail} categories={data.categories} backHref={backHref} />
    </PageShell>
  );
}
