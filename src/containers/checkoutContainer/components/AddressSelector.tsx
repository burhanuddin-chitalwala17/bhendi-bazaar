// components/checkout/AddressSelector.tsx

"use client";

import { MapPin, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DeliveryAddress } from "@/domain/profile";

interface AddressSelectorProps {
  selectedAddress: DeliveryAddress | null;
  addresses: DeliveryAddress[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (address: DeliveryAddress) => void;
  onAddNew: () => void;
}

export function AddressSelector({
  selectedAddress,
  addresses,
  isOpen,
  onToggle,
  onSelect,
  onAddNew,
}: AddressSelectorProps) {
  if (!selectedAddress) {
    return (
      <Card className="p-5">
        <p className="mb-3 text-sm text-muted-foreground">
          You don&apos;t have any saved addresses.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onAddNew}
          className="w-full"
        >
          <MapPin className="mr-2 h-4 w-4" />
          Add delivery address
        </Button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-5 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex gap-3">
          <MapPin className="mt-0.5 h-5 w-5 text-info" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{selectedAddress.fullName}</span>
              {selectedAddress.metadata?.isDefault && (
                <Badge variant="secondary" className="text-[0.65rem]">
                  Default
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {[
                selectedAddress.addressLine1,
                selectedAddress.addressLine2,
                selectedAddress.city,
                selectedAddress.state,
                selectedAddress.pincode,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        </div>
        <ChevronRight
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform",
            isOpen && "rotate-90"
          )}
        />
      </button>

      {/* Address Dropdown */}
      {isOpen && (
        <div className="border-t border-border/60 bg-muted/20 p-4">
          <div className="space-y-2">
            {addresses
              .filter((addr) => addr.id !== selectedAddress.id)
              .map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => {
                    onSelect(address);
                    onToggle();
                  }}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{address.metadata?.label}</span>
                      {address.metadata?.isDefault && (
                        <Badge variant="secondary" className="text-[0.6rem]">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[address.addressLine1, address.city, address.pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </button>
              ))}

            <button
              type="button"
              onClick={() => {
                onAddNew();
                onToggle();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-3 text-sm font-medium text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
            >
              <MapPin className="h-4 w-4" />
              Add new address
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}