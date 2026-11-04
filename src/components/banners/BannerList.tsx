"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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
import { BANNER_LIST_COPY } from "./banner-copy";
import { ROUTES } from "@server/shared/routes";

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
        title={BANNER_LIST_COPY.emptyTitle}
        description={BANNER_LIST_COPY.emptyDescription}
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
                    shape="icon"
                    aria-label={BANNER_LIST_COPY.moveUp(bannerLabel(banner.title))}
                    disabled={index === 0 || frozen}
                    onClick={() => move(index, index - 1)}
                    className={TAP}
                  >
                    <Icon name="move-up" />
                  </Button>
                  <Button
                    variant="outline"
                    shape="icon"
                    aria-label={BANNER_LIST_COPY.moveDown(bannerLabel(banner.title))}
                    disabled={index === rows.length - 1 || frozen}
                    onClick={() => move(index, index + 1)}
                    className={TAP}
                  >
                    <Icon name="move-down" />
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
                      <Icon name="no-photo" />
                    ) : (
                      <Icon name="photo" />
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {banner.eyebrow && (
                    <p className="truncate text-2xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
                      {banner.eyebrow}
                    </p>
                  )}
                  <p
                    className={`truncate font-medium${banner.title ? "" : " italic text-muted-foreground"}`}
                  >
                    {bannerLabel(banner.title)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge tone={banner.isActive ? "success" : "destructive"}
                    >
                      {banner.isActive ? BANNER_LIST_COPY.live : BANNER_LIST_COPY.down}
                    </StatusBadge>
                    {banner.imageUrl &&
                      !isRenderableImageUrl(banner.imageUrl) && (
                        <span className="text-2xs text-warning">
                          {BANNER_LIST_COPY.reupload}
                        </span>
                      )}
                    <span className="text-2xs text-muted-foreground">
                      {BANNER_LIST_COPY.buttons(banner.actions.length)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={banner.isActive}
                    aria-label={BANNER_LIST_COPY.toggle(banner.isActive, bannerLabel(banner.title))}
                    disabled={frozen}
                    onCheckedChange={(on) => setActive(banner, on)}
                  />
                  <Button
                    asChild
                    variant="outline"
                    shape="icon"
                    aria-label={BANNER_LIST_COPY.edit(bannerLabel(banner.title))}
                    className={TAP}
                  >
                    <Link
                      href={ROUTES.admin.editBanner(banner.id)}
                      prefetch={false}
                    >
                      <Icon name="edit" />
                    </Link>
                  </Button>
                  {/* Delete is fenced off from Edit rather than sitting one gap away
                      from it: a 40px target beside the control you press most is how
                      an irreversible action gets mis-tapped on a phone. */}
                  <div className="ms-1 border-s border-border ps-3">
                    <Button
                      variant="ghost"
                      shape="icon"
                      aria-label={BANNER_LIST_COPY.delete(bannerLabel(banner.title))}
                      disabled={frozen}
                      onClick={() => setConfirming(banner)}
                      className={`${TAP} text-muted-foreground hover:bg-destructive/10 hover:text-destructive`}
                    >
                      <Icon name="delete" />
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
            <DialogTitle>{BANNER_LIST_COPY.confirmTitle}</DialogTitle>
            <DialogDescription>{BANNER_LIST_COPY.confirmBody(bannerLabel(confirming?.title))}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirming(null)}
              className="h-10"
            >
              {BANNER_LIST_COPY.keep}
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirming && remove(confirming)}
              className="h-10"
            >
              {BANNER_LIST_COPY.confirmDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
