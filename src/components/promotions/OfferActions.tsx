"use client";

/**
 * Edit and stop, on an offer card.
 *
 * A client leaf inside a server-rendered list — the list itself needs no interactivity,
 * so the boundary sits here rather than at the page.
 *
 * "Stop" is a deactivation, never a delete: an order's discount record may already
 * name this offer, and that record has to outlive it (ADR-0020). The label says stop
 * because that is also what an operator means — the campaign happened.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import { offersApiClient } from "@/components/promotions/offersApiClient";

export function OfferActions({
  editHref,
  stopHref,
  isActive,
  label,
}: {
  editHref: string;
  stopHref: string;
  isActive: boolean;
  label: string;
}) {
  const router = useRouter();
  const { mutate, isLoading: isStopping } = useMutation(
    () => offersApiClient.stop(stopHref),
    {
      successMessage: `“${label}” stopped`,
      onSuccess: () => router.refresh(),
    },
  );

  // The toast is the whole report; the rejection has nowhere further to go.
  const stop = () => mutate().catch(() => {});

  return (
    <div className="mt-3 flex gap-2 border-t border-border pt-3">
      <Button asChild variant="outline" size="sm">
        <Link href={editHref} prefetch={false}>
          <Pencil className="size-3.5" aria-hidden /> Edit
        </Link>
      </Button>
      {isActive && (
        <Button variant="ghost" size="sm" onClick={stop} disabled={isStopping}>
          <Square className="size-3.5" aria-hidden />
          {isStopping ? "Stopping…" : "Stop"}
        </Button>
      )}
    </div>
  );
}
