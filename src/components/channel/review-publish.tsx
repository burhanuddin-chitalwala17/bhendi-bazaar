"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LockedAction } from "@/components/subscriptions/locked-action";
import { ActionBar } from "@/components/shared/action-bar";
import { useMutation } from "@/hooks/core/useMutation";
import { cn } from "@/lib/utils";
import { LISTING_FIELD, type ListingField, type ReviewChangeDTO, type ReviewDTO, type ReviewValue } from "@server/channels/platform-listing.types";

import type { ListingPublishInput } from "@/lib/validation/schemas/platform-listing.schema";
import { listingsApiClient } from "./listingsApiClient";
import { FIELD_NAME, LISTING, PUBLISH, rupees } from "./platform-listing-copy";
import { ROUTES } from "@server/shared/routes";
import { FEATURE } from "@/components/subscriptions/features";

const PAGE = 20;
const key = (listingId: string, field: ListingField) => `${listingId}:${field}`;

/**
 * Review and publish (marketplace-publish ux.md): each change old above new, each undoable; Publish
 * sends what is left, at the versions shown (D3). A listing that moved meanwhile comes back refused.
 */
export function ReviewPublish({ orgId, review, single }: { orgId: string; review: ReviewDTO; single: string | null }) {
  const router = useRouter();
  const [undone, setUndone] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const toggle = (k: string) => setUndone((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  });

  const items = review.listings
    .map((l) => ({ id: l.id, version: l.version, fields: l.changes.map((c) => c.field).filter((f) => !undone.has(key(l.id, f))) }))
    .filter((item) => item.fields.length > 0);
  const count = items.reduce((n, item) => n + item.fields.length, 0);
  const creating = review.listings.some((l) => l.creating);
  const back = single && review.listings[0]?.productId ? ROUTES.org.productListing(orgId, review.listings[0].productId, review.channel) : ROUTES.org.channelListings(orgId, review.channel);

  const publish = useMutation((body: ListingPublishInput) => listingsApiClient.publish(orgId, review.channel, body), {
    showToast: false,
    onSuccess: (result) => {
      if (result.refused.length > 0) toast.error(PUBLISH.refused);
      if (result.sent > 0) toast.success(PUBLISH.sentToast(review.label));
      router.push(back);
      router.refresh();
    },
    onError: () => toast.error(PUBLISH.failed),
  });

  if (review.listings.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card border bg-card p-4 text-sm">
        <p>{PUBLISH.empty(review.label)}</p>
        <Button asChild variant="outline" size="sm" className="min-h-10">
          <Link href={ROUTES.org.channelListings(orgId, review.channel)}>{PUBLISH.backToListings}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24 md:pb-4">
      {review.listings.length > 1 && <p className="text-sm text-muted-foreground">{PUBLISH.listingsCount(review.listings.length, review.totalChanges)}</p>}
      <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
        {review.listings.slice(0, shown).map((listing) => (
          <li key={listing.id} className="flex min-w-0 flex-col gap-2 rounded-card border bg-card p-4">
            <p className="text-sm font-semibold">{listing.productId ? listing.name : `${PUBLISH.familyPage} · ${listing.name}`}</p>
            {listing.changes.map((change) => (
              <ChangeRow key={change.field} change={change} label={review.label} undone={undone.has(key(listing.id, change.field))} onToggle={() => toggle(key(listing.id, change.field))} />
            ))}
          </li>
        ))}
      </ul>
      {shown < review.listings.length && (
        <Button type="button" variant="outline" size="sm" className="min-h-10 self-start" onClick={() => setShown((n) => n + PAGE)}>
          {PUBLISH.showMore}
        </Button>
      )}
      <ActionBar className="-mx-4 md:mx-0">
        <LockedAction feature={FEATURE.CHANNELS} label={PUBLISH.publish(count, review.label)} className="min-h-10 w-full md:w-auto">
          <Button type="button" className="min-h-10 w-full md:w-auto" pending={publish.isLoading} onClick={() => (items.length === 0 ? toast.info(PUBLISH.nothingLeft) : void publish.mutate({ items }).catch(() => undefined))}>
            {creating && count === review.totalChanges && review.listings.every((l) => l.creating) ? PUBLISH.create(review.label) : PUBLISH.publish(count, review.label)}
          </Button>
        </LockedAction>
      </ActionBar>
    </div>
  );
}

function ChangeRow({ change, label, undone, onToggle }: { change: ReviewChangeDTO; label: string; undone: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-2 text-sm first-of-type:border-t-0 first-of-type:pt-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-tag text-muted-foreground">{FIELD_NAME[change.field]}</span>
        <Button type="button" variant="link" size="sm" className="h-auto min-h-10 p-0 md:min-h-0" onClick={onToggle}>
          {undone ? PUBLISH.putBack : PUBLISH.undo}
        </Button>
      </div>
      <div className="flex flex-col gap-1 md:grid md:grid-cols-2 md:gap-3">
        {change.from !== null && (
          <div className="min-w-0 text-muted-foreground line-through">
            <Value field={change.field} value={change.from} />
          </div>
        )}
        <div className={cn("min-w-0", undone ? "text-muted-foreground line-through" : "font-medium")}>
          <Value field={change.field} value={change.to} />
        </div>
      </div>
      {change.big && !undone && change.from !== null && (
        <p className="text-xs text-warning">{PUBLISH.bigChange(rupees(change.from as number), rupees(change.to as number))}</p>
      )}
      {change.field === LISTING_FIELD.LISTED && undone && <p className="sr-only">{label}</p>}
    </div>
  );
}

function Value({ field, value }: { field: ListingField; value: ReviewValue }) {
  if (field === LISTING_FIELD.PRICE) return <span className="tabular-nums">{rupees(value as number)}</span>;
  if (field === LISTING_FIELD.LISTED) return <span>{value ? LISTING.onSale : LISTING.paused}</span>;
  if (field === LISTING_FIELD.PHOTOS) {
    return (
      <span className="flex gap-1 overflow-hidden">
        {(value as string[]).slice(0, 6).map((url, i) => (
          <span key={`${url}-${i}`} className="relative size-10 shrink-0 overflow-hidden rounded-field">
            <Image src={url} alt="" fill sizes="40px" className="object-cover" />
          </span>
        ))}
      </span>
    );
  }
  if (field === LISTING_FIELD.FEATURES) {
    return (
      <ul className="list-disc pl-4">
        {(value as string[]).map((f, i) => (
          <li key={i} className="break-words">{f}</li>
        ))}
      </ul>
    );
  }
  return <span className="line-clamp-3 break-words">{String(value)}</span>;
}
