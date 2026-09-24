"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { readApiError } from "@/lib/api-error";
import { bannerLabel } from "@/lib/banner-label";
import { AddPromotionDialog } from "@/components/org/add-promotion-dialog";

export interface ManagedBanner {
  id: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
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
  const [busy, setBusy] = useState(false);

  const base = `/api/org/${orgId}/storefront/banners`;

  const call = async (url: string, init: RequestInit) => {
    setBusy(true);
    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      if (!response.ok) throw await readApiError(response);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (banner: ManagedBanner) => {
    await call(`${base}/${banner.id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...banner, isActive: !banner.isActive }),
    });
  };

  const remove = async (banner: ManagedBanner) => {
    if (await call(`${base}/${banner.id}`, { method: "DELETE" })) {
      toast.success("Promotion deleted.");
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...banners];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await call(`${base}/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ ids: next.map((b) => b.id) }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Promotions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-2xs text-muted-foreground">
          Cards that run across the top of your shop — a picture, a line of
          words, and somewhere to go. Add more than one and they rotate.
          <br />
          <strong className="text-foreground">
            Changes here apply straight away
          </strong>{" "}
          — they are not part of the Save button below.
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
                <StatusBadge status={banner.isActive ? "inStock" : "default"}>
                  {banner.isActive ? "Live" : "Down"}
                </StatusBadge>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${bannerLabel(banner.title)} up`}
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move ${bannerLabel(banner.title)} down`}
                    disabled={busy || index === banners.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Checkbox
                    label={banner.isActive ? "Live" : "Down"}
                    checked={banner.isActive}
                    onChange={() => toggle(banner)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${bannerLabel(banner.title)}`}
                    className="text-destructive"
                    disabled={busy}
                    onClick={() => remove(banner)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <AddPromotionDialog orgId={orgId} handle={handle} />
      </CardContent>
    </Card>
  );
}
