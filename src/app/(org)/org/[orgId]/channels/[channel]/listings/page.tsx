import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/org-auth";
import { channelListingsDAL, type ListingsTab } from "@/data-access-layer/channel-listings.dal";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ListingList } from "@/components/channel/listing-list";
import { StockSyncSection } from "@/components/channel/stock-sync-section";
import { channelStockDAL } from "@/data-access-layer/channel-stock.dal";
import { platformListingDAL } from "@/data-access-layer/platform-listing.dal";
import { LISTING, PUBLISH } from "@/components/channel/platform-listing-copy";
import { SameItemCard } from "@/components/channel/same-item-card";
import { GroupPicker } from "@/components/channel/group-picker";
import { GROUP } from "@/components/channel/family-copy";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import { ListingDetailsPanel } from "@/components/channel/listing-details-panel";
import { ReadAgainButton } from "@/components/channel/read-again-button";
import { ReadProgressRefresher } from "@/components/channel/read-progress-refresher";
import { LISTINGS, pageReadLine } from "@/components/channel/listing-copy";
import { LISTINGS_SETTLE } from "@/components/channel/settle-copy";
import { cn } from "@/lib/utils";
import { READ_ERROR, READ_STATE } from "@server/channels/channel-connection.types";
import { CHANNEL } from "@server/shared/channels";

export const metadata = {
  title: "Listings",
  robots: { index: false, follow: false },
};

type Search = { tab?: string; q?: string; more?: string; listing?: string; left?: string; pick?: string };

/** One marketplace's listings and their links (channel-import spec R1–R7, R10, ux.md "Listings page"). */
export default async function ChannelListingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; channel: string }>;
  searchParams: Promise<Search>;
}) {
  const { orgId, channel } = await params;
  const search = await searchParams;
  const scope = await requireOrgMember(orgId);
  const tab: ListingsTab = search.tab === "notLinked" ? "notLinked" : "linked";
  const q = search.q?.trim() || null;
  const pages = Math.max(1, Number.parseInt(search.more ?? "1", 10) || 1);

  const showLeftOff = tab === "notLinked" && search.left === "1";
  const picking = tab === "notLinked" && search.pick === "1";
  const [data, org, stock, waiting] = await Promise.all([channelListingsDAL.page(scope.orgId, channel, {
    tab: showLeftOff ? "leftOff" : tab,
    search: q,
    pages,
    listingId: search.listing ?? null,
  }), orgsDAL.getOrgSummary(scope.orgId), channelStockDAL.section(scope.orgId, channel), platformListingDAL.waitingCount(scope.orgId, channel)]);
  if (!data) notFound();
  const { page, detail } = data;
  const { label, read } = page;

  const base = `/org/${scope.orgId}/channels/${page.channel}/listings`;
  const hrefWith = (next: Partial<Record<keyof Search, string | null>>) => {
    const merged: Record<string, string | null> = {
      tab,
      q,
      more: pages > 1 ? String(pages) : null,
      listing: null,
      left: showLeftOff ? "1" : null,
      ...next,
    };
    const qs = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => !!e[1])).toString();
    return qs ? `${base}?${qs}` : base;
  };

  const rowsSoFar = page.counts.linked + page.counts.notLinked + page.counts.leftOff;
  const line = pageReadLine(read, label, rowsSoFar > 0);
  const refused =
    read.state === READ_STATE.STOPPED &&
    (read.error === READ_ERROR.OTHER_SHOP || read.error === READ_ERROR.AUTH || read.error === READ_ERROR.DIFFERENT_ACCOUNT);
  const running = read.state === READ_STATE.RUNNING && !read.stalled;
  const firstRead = running && rowsSoFar === 0;
  const empty = read.state === READ_STATE.DONE && rowsSoFar === 0;
  const emptyText = q
    ? LISTINGS.noMatches
    : showLeftOff
      ? LISTINGS_SETTLE.leftOffEmpty
      : tab === "notLinked"
        ? LISTINGS_SETTLE.allSettled(label)
        : null;
  const showRows = !refused && !empty && !firstRead;
  const canRead = page.connected && !refused;

  return (
    <div className="space-y-4">
      <ReadProgressRefresher running={running} />
      {waiting > 0 && (
        <div className="flex flex-col gap-2 rounded-card bg-info/10 p-3 text-sm md:flex-row md:items-center md:justify-between">
          <p className="font-semibold">{PUBLISH.bar(waiting)}</p>
          <Button asChild size="sm" className="min-h-10 self-start md:self-auto">
            <Link href={`/org/${scope.orgId}/channels/${channel}/publish`}>{LISTING.reviewAndPublish}</Link>
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SectionHeader as="h1" help="channels" title={LISTINGS.title(label)} />
        {canRead && !running && <ReadAgainButton orgId={scope.orgId} channel={page.channel} />}
        {!canRead && (
          <Button asChild variant="outline" className="min-h-10 w-full md:w-auto">
            <Link href={`/org/${scope.orgId}/channels`}>{LISTINGS.goToChannels}</Link>
          </Button>
        )}
      </div>

      {line && (
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
          {running && read.total ? (
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.round(((read.done ?? 0) / read.total) * 100))}%` }} />
            </div>
          ) : null}
        </div>
      )}

      {empty && <p className="rounded-card border bg-card p-4 text-sm text-muted-foreground">{LISTINGS.empty(label)}</p>}

      {firstRead && (
        <div className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-card" />
          ))}
        </div>
      )}

      {/* Stock sync sits above the listings it keeps right (inventory-sync ux.md). */}
      {stock && showRows && <StockSyncSection orgId={scope.orgId} section={stock.section} locations={stock.locations} />}

      {showRows && (
        <>
          <form action={base} method="get" className="flex gap-2">
            <input type="hidden" name="tab" value={tab} />
            <Input name="q" type="search" defaultValue={q ?? ""} placeholder={LISTINGS.search} aria-label={LISTINGS.search} />
          </form>

          <nav className="flex gap-2" aria-label={LISTINGS.title(label)}>
            {(["linked", "notLinked"] as const).map((t) => (
              <Button key={t} asChild variant={t === tab ? "default" : "outline"} className="min-h-10 flex-1 md:flex-none">
                <Link href={hrefWith({ tab: t, more: null, left: null })} aria-current={t === tab ? "page" : undefined} scroll={false}>
                  {t === "linked" ? LISTINGS.tabLinked(page.counts.linked) : LISTINGS.tabNotLinked(page.counts.notLinked)}
                </Link>
              </Button>
            ))}
          </nav>

          {tab === "notLinked" && (
            <Button asChild variant={showLeftOff ? "secondary" : "ghost"} size="sm" className="self-start">
              <Link href={hrefWith({ left: showLeftOff ? null : "1", more: null })} aria-pressed={showLeftOff} scroll={false}>
                {LISTINGS_SETTLE.showLeftOff(page.counts.leftOff)}
              </Link>
            </Button>
          )}

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>{LISTINGS.lastReported(label)}</p>
            {page.channel === CHANNEL.FLIPKART && <p>{LISTINGS.flipkartUngrouped}</p>}
          </div>

          {/* Listings that look like one item, and picking them by hand (family-merge D6). */}
          {tab === "notLinked" && !showLeftOff && !picking && page.sameItem.map((s) => (
            <SameItemCard key={s.listingIds.join(",")} orgId={scope.orgId} channel={page.channel} listingIds={s.listingIds} titles={s.titles} />
          ))}
          {tab === "notLinked" && !showLeftOff && !picking && page.counts.notLinked >= 2 && (
            <Button asChild variant="outline" size="sm" className="min-h-10 self-start">
              <Link href={hrefWith({ pick: "1", listing: null })} scroll={false}>
                {GROUP.groupListings}
              </Link>
            </Button>
          )}

          {picking ? (
            <GroupPicker orgId={scope.orgId} listings={page.listings} cancelHref={hrefWith({ pick: null })} />
          ) : page.listings.length === 0 ? (
            emptyText && <p className="rounded-card border bg-card p-4 text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <ListingList
              orgId={scope.orgId}
              shopName={org?.name ?? ""}
              channel={page.channel}
              label={label}
              listings={page.listings}
              hrefFor={(id) => hrefWith({ listing: id })}
              groups={page.groups}
              firstFamily={page.firstFamily}
            />
          )}

          {page.hasMore && (
            <Button asChild variant="outline" className="min-h-10 w-full">
              <Link href={hrefWith({ more: String(pages + 1) })} scroll={false}>
                {LISTINGS.showMore}
              </Link>
            </Button>
          )}
        </>
      )}

      {detail && (
        <ListingDetailsPanel orgId={scope.orgId} channel={page.channel} label={label} detail={detail} closeHref={hrefWith({})} />
      )}
    </div>
  );
}
