import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { RefreshButton } from "@/components/channel/refresh-button";
import { ShopLinkCard } from "@/components/org/shop-hub/shop-link-card";
import { AddPickupAddressRow } from "@/components/org/shop-hub/add-pickup-address-row";
import { SHOP_HUB_COPY } from "@/components/org/shop-hub/shop-hub-copy";
import { brandPageShowing, brandPageStanding } from "@/components/storefront/brand-page/standing";
import { shopHubDAL, type ShopHubData } from "@/data-access-layer/org/shop-hub.dal";
import { requireOrgMember } from "@/lib/org-auth";

export const metadata = { title: "Shop", robots: { index: false, follow: false } };

/** The hub's four rows, compared by constant. */
const HUB_ROW = { DETAILS: "details", PAGE: "page", ADDRESSES: "addresses", REVIEWS: "reviews" } as const;
type HubRowKey = (typeof HUB_ROW)[keyof typeof HUB_ROW];

interface HubRow {
  key: HubRowKey;
  icon: IconName;
  href: string;
  /** null when the row's read failed: it shows its own retry. */
  status: string | null;
  done: boolean;
}

function rowsFor(data: ShopHubData, orgId: string): HubRow[] {
  const base = `/org/${orgId}`;
  const missing = data.details.ok ? [!data.details.value.hasLogo, !data.details.value.hasTagline].filter(Boolean).length : 0;
  const page = data.page.ok && data.page.value ? brandPageShowing(brandPageStanding(data.page.value, orgId)) : null;
  return [
    {
      key: HUB_ROW.DETAILS,
      icon: "id-card",
      href: `${base}/shop/details`,
      status: data.details.ok ? (missing === 0 ? SHOP_HUB_COPY.detailsDone : SHOP_HUB_COPY.detailsToAdd(missing)) : null,
      done: data.details.ok && missing === 0,
    },
    {
      key: HUB_ROW.PAGE,
      icon: "layout",
      href: `${base}/storefront`,
      status: page ? SHOP_HUB_COPY.pageShowing(page.showing, page.total) : data.page.ok ? SHOP_HUB_COPY.pageNotLive : null,
      done: page !== null && page.showing > 0,
    },
    {
      key: HUB_ROW.ADDRESSES,
      icon: "location",
      href: `${base}/locations`,
      status: data.addresses.ok
        ? data.addresses.value.active === 0
          ? SHOP_HUB_COPY.addressesNone
          : SHOP_HUB_COPY.addressesCount(data.addresses.value.active)
        : null,
      done: data.addresses.ok && data.addresses.value.active > 0,
    },
    {
      key: HUB_ROW.REVIEWS,
      icon: "rating",
      href: `${base}/reviews`,
      status: data.reviews.ok
        ? data.reviews.value.count === 0
          ? SHOP_HUB_COPY.reviewsNone
          : SHOP_HUB_COPY.reviewsCount(data.reviews.value.count)
        : null,
      // A shop with no reviews yet is not missing anything it can add.
      done: data.reviews.ok,
    },
  ];
}

const TITLES: Record<HubRowKey, string> = {
  [HUB_ROW.DETAILS]: SHOP_HUB_COPY.details,
  [HUB_ROW.PAGE]: SHOP_HUB_COPY.page,
  [HUB_ROW.ADDRESSES]: SHOP_HUB_COPY.addresses,
  [HUB_ROW.REVIEWS]: SHOP_HUB_COPY.reviews,
};

/** The Shop tab (own-store onboarding D3, Q8): the link first, then everything about the shop. */
export default async function ShopHubPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const data = await shopHubDAL.forOrg(scope.orgId);
  const rows = rowsFor(data, scope.orgId);
  const allDone = rows.every((row) => row.done);

  return (
    <PageShell width="wide">
      <PageHeader help="shop" title={SHOP_HUB_COPY.title} description={SHOP_HUB_COPY.help} />
      {data.share && <ShopLinkCard orgId={scope.orgId} shop={data.share} />}
      {allDone && <p className="text-small font-medium text-foreground">{SHOP_HUB_COPY.allDone}</p>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <li key={row.key}>
            {/* No address at all: create it here, over the hub (D11). Paused ones keep the link to reactivate them. */}
            {row.key === HUB_ROW.ADDRESSES && data.addresses.ok && data.addresses.value.total === 0 ? (
              <AddPickupAddressRow orgId={scope.orgId} />
            ) : (
              <HubRowView row={row} title={TITLES[row.key]} />
            )}
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

function HubRowView({ row, title }: { row: HubRow; title: string }) {
  if (row.status === null) {
    return (
      <div className="flex min-h-14 flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4">
        <Icon name={row.icon} size="md" tone="muted" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-small text-muted-foreground">{SHOP_HUB_COPY.rowFailed}</p>
        </div>
        <RefreshButton label={SHOP_HUB_COPY.tryAgain} />
      </div>
    );
  }
  return (
    <Link
      prefetch={false}
      href={row.href}
      className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-card p-4 transition-colors hover:bg-muted/60"
    >
      <Icon name={row.icon} size="md" tone="primary" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="block text-small text-muted-foreground">{row.status}</span>
      </span>
      <span className="shrink-0 text-small font-medium text-primary">{row.done ? SHOP_HUB_COPY.open : SHOP_HUB_COPY.add}</span>
      <Icon name="next" size="sm" tone="muted" />
    </Link>
  );
}
