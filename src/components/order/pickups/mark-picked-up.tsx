"use client";


import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PICKED_UP_COPY } from "./pickups-copy";
import { useMarkPickedUp } from "./useMarkPickedUp";

/** Never disabled (R15): a press while marking does nothing. */
export function MarkPickedUp({ shipmentId }: { shipmentId: string }) {
  const { mark, marking } = useMarkPickedUp(shipmentId);
  return (
    <Button size="sm" variant="outline" onClick={mark} pending={marking}>
      <Icon name="success" />
      {marking ? PICKED_UP_COPY.marking : PICKED_UP_COPY.open}
    </Button>
  );
}
