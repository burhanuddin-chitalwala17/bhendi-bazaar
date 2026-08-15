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

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/api-error";

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
  const [isStopping, setIsStopping] = useState(false);

  const stop = async () => {
    setIsStopping(true);
    try {
      const response = await fetch(stopHref, { method: "DELETE" });
      if (!response.ok) throw await readApiError(response);
      toast.success(`“${label}” stopped`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not stop the offer");
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="mt-3 flex gap-2 border-t border-border pt-3">
      <Button asChild variant="outline" size="sm">
        <Link href={editHref}>
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
