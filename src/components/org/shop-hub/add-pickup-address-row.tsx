"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

import { Button } from "@/components/ui/button";
import { PickupAddressSheet } from "@/components/org/pickup-address-sheet";
import { SHOP_HUB_COPY } from "./shop-hub-copy";

/** The hub's addresses row before there is one: "Add" opens the sheet here, not another page (D11). */
export function AddPickupAddressRow({ orgId }: { orgId: string }) {
  const router = useRouter();
  return (
    <PickupAddressSheet
      orgId={orgId}
      onAdded={() => router.refresh()}
      trigger={
        <Button
          type="button"
          variant="ghost"
          className="flex h-auto min-h-14 w-full items-center justify-start gap-3 whitespace-normal rounded-card border border-border bg-card p-4 text-left font-normal hover:bg-muted/60"
        >
          <Icon name="location" size="md" tone="primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-foreground">{SHOP_HUB_COPY.addresses}</span>
            <span className="block text-sm text-muted-foreground">{SHOP_HUB_COPY.addressesNone}</span>
          </span>
          <span className="shrink-0 text-sm font-medium text-primary">{SHOP_HUB_COPY.add}</span>
          <Icon name="next" tone="muted" />
        </Button>
      }
    />
  );
}
