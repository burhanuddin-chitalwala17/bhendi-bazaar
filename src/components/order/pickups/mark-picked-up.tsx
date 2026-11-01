"use client";

import { Loader2, PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PICKED_UP_COPY } from "./pickups-copy";
import { useMarkPickedUp } from "./useMarkPickedUp";

/** Never disabled (R15): a press while marking does nothing. */
export function MarkPickedUp({ shipmentId }: { shipmentId: string }) {
  const { mark, marking } = useMarkPickedUp(shipmentId);
  return (
    <Button size="sm" variant="outline" className="min-h-10" onClick={mark} aria-busy={marking}>
      {marking ? <Loader2 className="mr-2 size-4 animate-spin" /> : <PackageCheck className="mr-2 size-4" />}
      {marking ? PICKED_UP_COPY.marking : PICKED_UP_COPY.open}
    </Button>
  );
}
