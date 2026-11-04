"use client";

/**
 * Edit and stop, on an offer's row. The whole row opens the edit page; Edit is spelled out
 * from a tablet, where a table row reads less obviously as a link.
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
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useMutation } from "@/hooks/core/useMutation";
import { offersApiClient } from "@/components/promotions/offersApiClient";
import { OFFER_ACTIONS_COPY } from "./promotions-copy";

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
      successMessage: OFFER_ACTIONS_COPY.stopped(label),
      onSuccess: () => router.refresh(),
    },
  );

  // The toast is the whole report; the rejection has nowhere further to go.
  const stop = () => mutate().catch(() => {});

  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
        <Link href={editHref} prefetch={false}>
          <Icon name="edit" size="xs" /> {OFFER_ACTIONS_COPY.edit}
        </Link>
      </Button>
      {isActive && (
        <Button variant="ghost" size="sm" onClick={stop} pending={isStopping}>
          {!isStopping && <Icon name="square" size="xs" />}
          {isStopping ? OFFER_ACTIONS_COPY.stopping : OFFER_ACTIONS_COPY.stop}
        </Button>
      )}
    </div>
  );
}
