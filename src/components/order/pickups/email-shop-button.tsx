"use client";


import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { NOT_PACKED_COPY } from "./pickups-copy";
import { useEmailShop } from "./useEmailShop";
import { EMAIL_SHOP_BUTTON_COPY } from "./pickups-copy";

/** Never disabled (R15): a press while sending does nothing; a refusal says why in a toast. */
export function EmailShopButton({ shipmentId }: { shipmentId: string }) {
  const { send, sending } = useEmailShop(shipmentId);
  return (
    <Button variant="outline" size="sm" onClick={send} pending={sending}>
      <Icon name="email" />
      {sending ? NOT_PACKED_COPY.sending : NOT_PACKED_COPY.emailShop}
    </Button>
  );
}
