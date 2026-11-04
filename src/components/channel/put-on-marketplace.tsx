"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";
import type { ListingDraftInput } from "@/lib/validation/schemas/platform-listing.schema";

import { listingsApiClient } from "./listingsApiClient";
import { CREATE } from "./platform-listing-copy";
import { usePagesSearch } from "./usePagesSearch";
import { ROUTES } from "@server/shared/routes";

interface Start {
  channel: MarketplaceChannel;
  label: string;
  productId: string;
  productName: string;
  canCreate: boolean;
  family: { id: string; name: string; members: number; axis: string } | null;
}

/**
 * Put on Amazon (marketplace-publish ux.md): the product's page is looked for first, by barcode then
 * name, so it is joined rather than duplicated (D6); otherwise a new page, or the whole family (Q11).
 * Either way a draft opens for review; nothing reaches the marketplace until Publish.
 */
export function PutOnMarketplace({ orgId, start }: { orgId: string; start: Start }) {
  const router = useRouter();
  const search = usePagesSearch(orgId, start.productId, start.channel);
  const listingHref = ROUTES.org.productListing(orgId, start.productId, start.channel);

  const draft = useMutation((body: ListingDraftInput) => listingsApiClient.startDraft(orgId, start.productId, start.channel, body), {
    showToast: false,
    onSuccess: () => router.push(listingHref),
    onError: (error) => toast.error(error.message || CREATE.unreachable(start.label)),
  });
  const family = useMutation(() => listingsApiClient.startFamily(orgId, start.family?.id ?? "", start.channel), {
    showToast: false,
    onSuccess: () => router.push(ROUTES.org.channelPublish(orgId, start.channel)),
    onError: (error) => toast.error(error.message || CREATE.unreachable(start.label)),
  });

  if (!start.canCreate) return <p className="rounded-card border bg-card p-4 text-sm">{CREATE.flipkartHow}</p>;

  const pages = search.data?.pages ?? [];
  const createNew = (
    <Button type="button" variant={pages.length > 0 ? "outline" : "default"} className="min-h-10" pending={draft.isLoading} onClick={() => void draft.mutate({ mode: "new", targetExternalId: null }).catch(() => undefined)}>
      {pages.length > 0 ? CREATE.noneOfThese : CREATE.createNew}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-card border bg-card p-4">
        {search.loading && <p className="text-sm text-muted-foreground">{CREATE.looking(start.label)}</p>}
        {search.error && (
          <div className="flex flex-col items-start gap-2 text-sm">
            <p className="text-destructive">{CREATE.unreachable(start.label)}</p>
            <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => void search.refetch()}>
              {CREATE.tryAgain}
            </Button>
          </div>
        )}
        {!search.loading && !search.error && search.data && pages.length === 0 && <p className="text-sm">{CREATE.notFound(start.label)}</p>}
        {pages.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">{CREATE.found(pages.length)}</p>
            <ul className="flex flex-col gap-3 md:grid md:grid-cols-2">
              {pages.map((page) => (
                <li key={page.externalId} className="flex min-w-0 gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0 md:border-t-0 md:pt-0">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-field bg-muted">
                    {page.imageUrl && <Image src={page.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="break-words text-sm font-medium">{page.title}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{`ASIN ${page.externalId} · ${CREATE.matchedBy[page.matchedBy]}`}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10 self-start"
                      pending={draft.isLoading}
                      onClick={() => void draft.mutate({ mode: "offer", targetExternalId: page.externalId }).catch(() => undefined)}
                    >
                      {CREATE.sellHere}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {!search.loading && createNew}
      </section>

      {start.family && (
        <section className="flex flex-col items-start gap-2 rounded-card border bg-card p-4">
          <p className="text-sm font-semibold">{start.family.name}</p>
          <p className="text-sm text-muted-foreground">{CREATE.familyOf(start.family.members, start.family.axis)}</p>
          <Button type="button" className="min-h-10" pending={family.isLoading} onClick={() => void family.mutate().catch(() => undefined)}>
            {CREATE.putFamilyOn(start.label)}
          </Button>
        </section>
      )}
    </div>
  );
}
