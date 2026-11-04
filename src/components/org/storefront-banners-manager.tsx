"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { useMutation } from "@/hooks/core/useMutation";
import { bannerLabel } from "@/lib/banner-label";
import { AddPromotionSheet } from "@/components/org/add-promotion-sheet";
import { orgStorefrontApiClient } from "@/components/org/orgStorefrontApiClient";
import type { ImageSlotValue } from "@server/catalog/image-framing";
import { BANNERS_COPY } from "./storefront-copy";

export interface ManagedBanner {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  /** Both pictures as the editor holds them, so a take-down sends them back unchanged (image-slots). */
  image: ImageSlotValue | null;
  imageAlt: string | null;
  href: string | null;
  isActive: boolean;
}

/**
 * Where an org runs its promotions (storefront-branding R2a, R2b).
 *
 * Take-down rather than delete is the default action, because a campaign that ran once
 * will run again next season and re-uploading its artwork to do that is busywork.
 * Delete is available and deliberate.
 *
 * Ordering is the whole list at once — the server takes an array of ids — so the result
 * is what the org saw, rather than the sum of several move-up requests that could
 * interleave.
 *
 * **The list is read from props, never copied into state.** It was held in
 * `useState(initial)` once, which meant `router.refresh()` fetched the new list and the
 * component kept rendering the old one: adding a promotion appeared to do nothing at
 * all. Server data belongs to the server component; this one owns only the draft.
 */
export function StorefrontBannersManager({
  orgId,
  handle,
  banners,
}: {
  orgId: string;
  handle: string;
  banners: ManagedBanner[];
}) {
  const router = useRouter();
  const refresh = { onSuccess: () => router.refresh() };

  const toggleBanner = useMutation(
    (banner: ManagedBanner) =>
      orgStorefrontApiClient.updateBanner(orgId, { ...banner, isActive: !banner.isActive }),
    refresh,
  );
  const deleteBanner = useMutation(
    (bannerId: string) => orgStorefrontApiClient.deleteBanner(orgId, bannerId),
    { ...refresh, successMessage: BANNERS_COPY.deleted },
  );
  const reorderBanners = useMutation(
    (ids: string[]) => orgStorefrontApiClient.reorderBanners(orgId, ids),
    refresh,
  );
  const busy = toggleBanner.isLoading || deleteBanner.isLoading || reorderBanners.isLoading;

  // `useMutation` toasts a failure and rethrows; the catches keep it from going unhandled.
  // Never disabled (ADR-0053): a tap while another change is saving says so instead.
  const stillSaving = () => {
    if (busy) toast(BANNERS_COPY.stillSaving);
    return busy;
  };

  const toggle = (banner: ManagedBanner) => {
    if (stillSaving()) return;
    void toggleBanner.mutate(banner).catch(() => {});
  };

  const remove = (banner: ManagedBanner) => {
    if (stillSaving()) return;
    void deleteBanner.mutate(banner.id).catch(() => {});
  };

  const move = (index: number, direction: -1 | 1) => {
    if (stillSaving()) return;
    const next = [...banners];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void reorderBanners.mutate(next.map((b) => b.id)).catch(() => {});
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{BANNERS_COPY.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-2xs text-muted-foreground">
          {BANNERS_COPY.intro}
          <br />
          <strong className="text-foreground">{BANNERS_COPY.appliesNow}</strong>{" "}
          {BANNERS_COPY.notSaved}
        </p>

        {banners.length > 0 && (
          <ul className="space-y-2">
            {banners.map((banner, index) => (
              <li
                key={banner.id}
                className="flex items-center gap-3 rounded-field border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium${banner.title ? "" : " italic text-muted-foreground"}`}
                  >
                    {bannerLabel(banner.title)}
                  </p>
                  {banner.href && (
                    <p className="truncate text-2xs text-muted-foreground">
                      {banner.href}
                    </p>
                  )}
                </div>
                <StatusBadge tone={banner.isActive ? "success" : "neutral"}>
                  {banner.isActive ? BANNERS_COPY.live : BANNERS_COPY.down}
                </StatusBadge>
                <div className="flex shrink-0 items-center gap-1">
                  {/* An arrow with nowhere to go is not drawn, rather than drawn and silent. */}
                  {index > 0 && (
                    <Button
                      variant="ghost"
                      shape="icon"
                      aria-label={BANNERS_COPY.moveUp(bannerLabel(banner.title))}
                      onClick={() => move(index, -1)}
                    >
                      <Icon name="move-up" />
                    </Button>
                  )}
                  {index < banners.length - 1 && (
                    <Button
                      variant="ghost"
                      shape="icon"
                      aria-label={BANNERS_COPY.moveDown(bannerLabel(banner.title))}
                      onClick={() => move(index, 1)}
                    >
                      <Icon name="move-down" />
                    </Button>
                  )}
                  <Checkbox
                    label={banner.isActive ? BANNERS_COPY.live : BANNERS_COPY.down}
                    checked={banner.isActive}
                    onChange={() => toggle(banner)}
                  />
                  <Button
                    variant="ghost"
                    shape="icon"
                    aria-label={BANNERS_COPY.delete(bannerLabel(banner.title))}
                    onClick={() => remove(banner)}
                  >
                    <Icon name="delete" tone="destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <AddPromotionSheet orgId={orgId} handle={handle} />
      </CardContent>
    </Card>
  );
}
