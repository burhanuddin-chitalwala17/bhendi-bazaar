"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, ImageIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { readApiError } from "@/lib/api-error";
import type { AdminBanner } from "@server/catalog/banner.types";

export function BannerList({ banners }: { banners: AdminBanner[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Optimistic only for order: a move is judged by where the row lands, and waiting a
  // round trip to see it makes the button feel broken.
  const [order, setOrder] = useState(banners);
  const [busy, setBusy] = useState(false);

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    try {
      const response = await fetch(url, init);
      if (!response.ok) throw await readApiError(response);
      startTransition(() => router.refresh());
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      setOrder(banners);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function move(from: number, to: number) {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
    await send("/api/admin/banners/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((b) => b.id) }),
    });
  }

  if (order.length === 0) {
    return (
      <EmptyState
        title="No banners yet"
        description="The storefront hero is empty until you add one."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {order.map((banner, index) => (
        <li key={banner.id}>
          <Card className="gap-0 p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {/* Reorder first in the DOM: on a phone the row stacks, and "where does
                  this sit" is the question the list is for. */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Move ${banner.title} up`}
                  disabled={index === 0 || busy || pending}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Move ${banner.title} down`}
                  disabled={index === order.length - 1 || busy || pending}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown />
                </Button>
              </div>

              {banner.imageUrl ? (
                <div className="relative aspect-[5/2] w-24 shrink-0 overflow-hidden rounded-field">
                  <Image src={banner.imageUrl} alt="" fill sizes="6rem" className="object-cover" />
                </div>
              ) : (
                <div className="flex aspect-[5/2] w-24 shrink-0 items-center justify-center rounded-field bg-muted text-muted-foreground">
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
                  disabled={busy || pending}
                  onCheckedChange={(on) =>
                    send(`/api/admin/banners/${banner.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: banner.title,
                        eyebrow: banner.eyebrow,
                        description: banner.description,
                        imageUrl: banner.imageUrl,
                        imageAlt: banner.imageAlt,
                        isActive: on,
                        actions: banner.actions.map(({ label, href, variant }) => ({
                          label,
                          href,
                          variant,
                        })),
                      }),
                    })
                  }
                />
                <Button asChild variant="outline" size="icon" aria-label={`Edit ${banner.title}`}>
                  <Link href={`/admin/banners/${banner.id}/edit`}>
                    <Pencil />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Delete ${banner.title}`}
                  disabled={busy || pending}
                  onClick={() => {
                    if (!confirm(`Delete “${banner.title}”? This cannot be undone.`)) return;
                    send(`/api/admin/banners/${banner.id}`, { method: "DELETE" });
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
