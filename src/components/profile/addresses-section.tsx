"use client";

import { useState } from "react";
import type { DeliveryAddress } from "@/domain/profile";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddressModal } from "./address-modal";
import { SkeletonRows } from "../shared/states/skeletons";
import { EmptyState } from "../shared/states/EmptyState";
import { LoadingSkeleton } from "../shared/states/LoadingSkeleton";
import { SectionHeader } from "../shared/SectionHeader";
import { Icon } from "@/components/ui/icon";
import { ADDRESSES_SECTION_COPY } from "./profile-copy";

interface AddressesSectionProps {
  addresses: DeliveryAddress[];
  loading?: boolean;
  saving?: boolean;
  onSaveAddress: (address: DeliveryAddress) => Promise<void>;
  onDeleteAddress: (addressId: string) => Promise<void>;
}

const EMPTY_ADDRESS: DeliveryAddress = {
  id: "",
  fullName: "",
  mobile: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: ADDRESSES_SECTION_COPY.india,
  label: "",
};

export function AddressesSection({
  addresses,
  loading,
  saving,
  onSaveAddress,
  onDeleteAddress,
}: AddressesSectionProps) {
  const [activeAddress, setActiveAddress] = useState<DeliveryAddress | null>(
    null,
  );
  const [modalMode, setModalMode] = useState<"view" | "edit" | "add" | null>(
    null,
  );

  const hasAddresses = addresses.length > 0;

  function handleAddClick() {
    setActiveAddress(EMPTY_ADDRESS);
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
    if (!confirm(ADDRESSES_SECTION_COPY.sureWantDeleteAddress)) {
      return;
    }
    await onDeleteAddress(addressId);
    handleCloseModal();
  }

  if (loading) {
    return (
      <div role="status" aria-label={ADDRESSES_SECTION_COPY.loadingAddresses}>
        <SkeletonRows count={3} thumbnail={false} />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SectionHeader
                overline={ADDRESSES_SECTION_COPY.addresses}
                title={ADDRESSES_SECTION_COPY.manageDeliveryLocationsContact}
              />
            </div>
            <Button
              type="button"
              shape="icon" size="lg"
              variant="outline"
              onClick={handleAddClick}
              disabled={loading || saving}
              className="shrink-0 rounded-full"
            >
              <Icon name="add" size="sm" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {!loading && !hasAddresses && (
            <EmptyState
              title={ADDRESSES_SECTION_COPY.donTHaveAny}
              description={ADDRESSES_SECTION_COPY.addOneSpeedUp}
            />
          )}
          {loading && <LoadingSkeleton count={3} />}
          {hasAddresses && (
            <div className="space-y-2">
              {addresses.map((address) => (
                <Button
                  variant="ghost"
                  key={address.id}
                  type="button"
                  onClick={() => handleAddressClick(address)}
                  className={cn(
                    "flex h-auto w-full items-center justify-between gap-3 whitespace-normal rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-left text-xs transition-colors hover:bg-muted/70",
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
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {activeAddress && modalMode && (
        <AddressModal
          mode={modalMode}
          address={activeAddress}
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
