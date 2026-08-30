"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { readApiError } from "@/lib/api-error";
import type { AdminBanner } from "@server/catalog/banner.types";

/** 40px on touch, the tighter desktop size from `sm`. */
const TAP = "size-10 sm:size-9";

export function BannerList({ banners }: { banners: AdminBanner[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // The server's list is the truth. A move shows its result before the round trip
  // finishes, and React drops the optimistic copy when the transition settles — so
  // nothing here can outlive the data it was guessing about, which is exactly how a
  // deleted banner used to stay on screen.
  const [rows, showReordered] = useOptimistic(
    banners,
    (_current, next: AdminBanner[]) => next
  );
  const [confirming, setConfirming] = useState<AdminBanner | null>(null);

  async function send(url: string, init: RequestInit) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) throw await readApiError(response);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[from], next[to]] = [next[to], next[from]];
    startTransition(async () => {
      showReordered(next);
      await send("/api/admin/banners/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((banner) => banner.id) }),
      });
    });
  }

  function setActive(banner: AdminBanner, isActive: boolean) {
    startTransition(() =>
      send(`/api/admin/banners/${banner.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
    );
  }

  function remove(banner: AdminBanner) {
    setConfirming(null);
    startTransition(() =>
      send(`/api/admin/banners/${banner.id}`, { method: "DELETE" })
    );
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
                    aria-label={`Move ${banner.title} up`}
                    disabled={index === 0 || isPending}
                    onClick={() => move(index, index - 1)}
                    className={TAP}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Move ${banner.title} down`}
                    disabled={index === rows.length - 1 || isPending}
                    onClick={() => move(index, index + 1)}
                    className={TAP}
                  >
                    <ArrowDown />
                  </Button>
                </div>

                {banner.imageUrl ? (
                  <div className="relative aspect-banner w-24 shrink-0 overflow-hidden rounded-field">
                    <Image src={banner.imageUrl} alt="" fill sizes="6rem" className="object-cover" />
                  </div>
                ) : (
                  <div className="flex aspect-banner w-24 shrink-0 items-center justify-center rounded-field bg-muted text-muted-foreground">
                    <ImageIcon className="size-4" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {banner.eyebrow && (
                    <p className="truncate text-4xs font-semibold uppercase tracking-eyebrow text-muted-foreground">
                      {banner.eyebrow}
                    </p>
                  )}
                  <p className="truncate font-medium">{banner.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={banner.isActive ? "inStock" : "outOfStock"}>
                      {banner.isActive ? "Live" : "Down"}
                    </StatusBadge>
                    <span className="text-2xs text-muted-foreground">
                      {banner.actions.length} button
                      {banner.actions.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={banner.isActive}
                    aria-label={`${banner.isActive ? "Take down" : "Publish"} ${banner.title}`}
                    disabled={isPending}
                    onCheckedChange={(on) => setActive(banner, on)}
                  />
                  <Button asChild variant="outline" size="icon" aria-label={`Edit ${banner.title}`} className={TAP}>
                    <Link href={`/admin/banners/${banner.id}/edit`}>
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
                      aria-label={`Delete ${banner.title}`}
                      disabled={isPending}
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

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this banner?</DialogTitle>
            <DialogDescription>
              “{confirming?.title}” and its buttons are removed for good. Taking it down
              with the switch keeps the copy and artwork for next time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)} className="h-10">
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
