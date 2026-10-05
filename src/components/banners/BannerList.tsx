"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ImageIcon,
  ImageOff,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { useMutation } from "@/hooks/core/useMutation";
import { bannerLabel } from "@/lib/banner-label";
import type { AdminBanner } from "@server/catalog/banner.types";
import { isRenderableImageUrl } from "@server/catalog/image-paths";
import { bannersApiClient } from "./bannersApiClient";

/** Order as written, and membership regardless of order. */
const sequenceOf = (list: AdminBanner[]) => list.map((b) => b.id).join("|");
const membersOf = (list: AdminBanner[]) =>
  list
    .map((b) => b.id)
    .sort()
    .join("|");

/** 40px on touch, the tighter desktop size from `sm`. */
const TAP = "size-10 sm:size-9";

export function BannerList({ banners }: { banners: AdminBanner[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<AdminBanner | null>(null);
  // A move shows its result before the round trip finishes. The override is held
  // against the server's list rather than against a transition: `router.refresh()`
  // returns as soon as the refresh is *dispatched*, so anything keyed to the
  // transition settling lets go while the RSC round trip is still in the air — the
  // list snaps back and the buttons re-arm mid-flight.
  const [override, setOverride] = useState<AdminBanner[] | null>(null);

  // Adjusting state during render is React's documented escape hatch for exactly this,
  // and it drops the override on a fact rather than on a timer: either the server now
  // agrees with it, or the set of banners changed under it and the server wins.
  let optimistic = override;
  if (
    override &&
    (sequenceOf(override) === sequenceOf(banners) ||
      membersOf(override) !== membersOf(banners))
  ) {
    setOverride(null);
    optimistic = null;
  }
  // Every write here ends the same way — refresh on success, toast on failure — so one
  // mutation runs whichever request it is handed.
  const { mutate, isLoading: busy } = useMutation(
    (request: () => Promise<void>) => request(),
    { onSuccess: () => startTransition(() => router.refresh()) },
  );
  const rows = optimistic ?? banners;
  const frozen = busy || isPending;

  const send = (request: () => Promise<void>): Promise<boolean> =>
    mutate(request).then(
      () => true,
      () => false,
    );

  async function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || frozen) return;
    const next = [...rows];
    [next[from], next[to]] = [next[to], next[from]];
    setOverride(next);
    const ok = await send(() =>
      bannersApiClient.reorder(next.map((banner) => banner.id)),
    );
    // A refused reorder must not leave the screen showing an order nobody stored.
    if (!ok) setOverride(null);
  }

  function setActive(banner: AdminBanner, isActive: boolean) {
    void send(() => bannersApiClient.setActive(banner.id, isActive));
  }

  function remove(banner: AdminBanner) {
    setConfirming(null);
    void send(() => bannersApiClient.remove(banner.id));
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No banners yet"
        description="The storefront hero is empty until you add one."
      />
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {rows.map((banner, index) => (
          <li key={banner.id}>
            <Card className="gap-0 p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                {/* Reorder first in the DOM: on a phone the row stacks, and "where
                    does this sit" is the question the list is for. */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Move ${bannerLabel(banner.title)} up`}
                    disabled={index === 0 || frozen}
                    onClick={() => move(index, index - 1)}
                    className={TAP}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Move ${bannerLabel(banner.title)} down`}
                    disabled={index === rows.length - 1 || frozen}
                    onClick={() => move(index, index + 1)}
                    className={TAP}
                  >
                    <ArrowDown />
                  </Button>
                </div>

                {isRenderableImageUrl(banner.imageUrl) ? (
                  <div className="relative aspect-banner-source w-24 shrink-0 overflow-hidden rounded-field">
                    <Image
                      src={banner.imageUrl}
                      alt=""
                      fill
                      sizes="6rem"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className={`flex aspect-banner-source w-24 shrink-0 items-center justify-center rounded-field bg-muted ${
                      banner.imageUrl ? "text-warning" : "text-muted-foreground"
                    }`}
                  >
                    {banner.imageUrl ? (
                      <ImageOff className="size-4" />
                    ) : (
                      <ImageIcon className="size-4" />
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {banner.eyebrow && (
                    <p className="truncate text-4xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
                      {banner.eyebrow}
                    </p>
                  )}
                  <p
                    className={`truncate font-medium${banner.title ? "" : " italic text-muted-foreground"}`}
                  >
                    {bannerLabel(banner.title)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={banner.isActive ? "inStock" : "outOfStock"}
                    >
                      {banner.isActive ? "Live" : "Down"}
                    </StatusBadge>
                    {banner.imageUrl &&
                      !isRenderableImageUrl(banner.imageUrl) && (
                        <span className="text-2xs text-warning">
                          Image needs re-uploading
                        </span>
                      )}
                    <span className="text-2xs text-muted-foreground">
                      {banner.actions.length} button
                      {banner.actions.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={banner.isActive}
                    aria-label={`${banner.isActive ? "Take down" : "Publish"} ${bannerLabel(banner.title)}`}
                    disabled={frozen}
                    onCheckedChange={(on) => setActive(banner, on)}
                  />
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    aria-label={`Edit ${bannerLabel(banner.title)}`}
                    className={TAP}
                  >
                    <Link
                      href={`/admin/banners/${banner.id}/edit`}
                      prefetch={false}
                    >
                      <Pencil />
                    </Link>
                  </Button>
                  {/* Delete is fenced off from Edit rather than sitting one gap away
                      from it: a 40px target beside the control you press most is how
                      an irreversible action gets mis-tapped on a phone. */}
                  <div className="ms-1 border-s border-border ps-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${bannerLabel(banner.title)}`}
                      disabled={frozen}
                      onClick={() => setConfirming(banner)}
                      className={`${TAP} text-muted-foreground hover:bg-destructive/10 hover:text-destructive`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this banner?</DialogTitle>
            <DialogDescription>
              “{bannerLabel(confirming?.title)}” and its buttons are removed for
              good. Taking it down with the switch keeps the copy and artwork
              for next time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirming(null)}
              className="h-10"
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirming && remove(confirming)}
              className="h-10"
            >
              Delete banner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
