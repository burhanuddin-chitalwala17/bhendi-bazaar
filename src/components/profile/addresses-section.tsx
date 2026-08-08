"use client";

import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import type { DeliveryAddress } from "@/domain/profile";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddressModal } from "./address-modal";
import { LoadingSpinner } from "../shared/states/LoadingSpinner";
import { EmptyState } from "../shared/states/EmptyState";
import { LoadingSkeleton } from "../shared/states/LoadingSkeleton";
import { SectionHeader } from "../shared/SectionHeader";

interface AddressesSectionProps {
  addresses: DeliveryAddress[];
  loading?: boolean;
  saving?: boolean;
  onSaveAddress: (address: DeliveryAddress) => Promise<void>;
  onDeleteAddress: (addressId: string) => Promise<void>;
}

export function AddressesSection({
  addresses,
  loading,
  saving,
  onSaveAddress,
  onDeleteAddress,
}: AddressesSectionProps) {
  const [activeAddress, setActiveAddress] = useState<DeliveryAddress | null>(
    null
  );
  const [modalMode, setModalMode] = useState<"view" | "edit" | "add" | null>(
    null
  );

  const hasAddresses = addresses.length > 0;

  function handleAddClick() {

    setModalMode("add");
  }

  function handleAddressClick(address: DeliveryAddress) {
    setActiveAddress(address);
    setModalMode("view");
  }

  function handleCloseModal() {
    setActiveAddress(null);
    setModalMode(null);
  }

  async function handleSave(address: DeliveryAddress) {
    await onSaveAddress(address);
    handleCloseModal();
  }

  async function handleDelete(addressId: string) {
    if (!confirm("Are you sure you want to delete this address?")) {
      return;
    }
    await onDeleteAddress(addressId);
    handleCloseModal();
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionHeader
                overline="Addresses"
                title="Manage your delivery locations and contact details."
              />
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={handleAddClick}
              disabled={loading || saving}
              className="rounded-full"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {!loading && !hasAddresses && (
            <EmptyState
              icon={MapPin}
              title="You don't have any saved addresses yet"
              description="Add one to speed up checkout."
            />
          )}
          {loading && <LoadingSkeleton count={3} />}
          {hasAddresses && (
            <div className="space-y-2">
              {addresses.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => handleAddressClick(address)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-left text-xs transition-colors hover:bg-muted/70"
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{address.label}</span>
                    </div>
                    <p className="line-clamp-1 text-muted-foreground">
                      {[
                        address.addressLine1,
                        address.addressLine2,
                        address.city,
                        address.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {activeAddress && modalMode && (
        <AddressModal
          mode={modalMode}
          address={{ ...activeAddress, id: "" }}
          saving={saving ?? false}
          onClose={handleCloseModal}
          onSave={handleSave}
          onStartEdit={() => setModalMode("edit")}
          onDelete={() => handleDelete(activeAddress.id)}
        />
      )}
    </>
  );
}

