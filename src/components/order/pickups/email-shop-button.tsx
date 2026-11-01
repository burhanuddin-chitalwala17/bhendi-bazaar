"use client";

import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NOT_PACKED_COPY } from "./pickups-copy";
import { useEmailShop } from "./useEmailShop";

/** Never disabled (R15): a press while sending does nothing; a refusal says why in a toast. */
export function EmailShopButton({ shipmentId }: { shipmentId: string }) {
  const { send, sending } = useEmailShop(shipmentId);
  return (
    <Button variant="outline" size="sm" className="min-h-10" onClick={send} aria-busy={sending}>
      {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
      {sending ? NOT_PACKED_COPY.sending : NOT_PACKED_COPY.emailShop}
    </Button>
  );
}
