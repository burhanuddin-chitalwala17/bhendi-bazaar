"use client";

import { useState, useEffect } from "react";
import { AddressModal } from "@/components/profile/address-modal";
import { AddressSelector } from "./AddressSelector";
import { DeliveryAddress } from "@/domain/profile";

interface AuthenticatedAddressProps {
  selectedAddress: DeliveryAddress | null;
  onAddressChange: (address: DeliveryAddress) => void;
  onAddressAdded: (address: DeliveryAddress) => Promise<DeliveryAddress>;
  onAddressUpdated: (id: string, address: DeliveryAddress) => void;
  addresses: DeliveryAddress[];
}

export function AuthenticatedAddress({
  selectedAddress,
  onAddressChange,
  onAddressAdded,
  onAddressUpdated,
  addresses,
}: AuthenticatedAddressProps) {
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // No default address (addresses-as-entities D3): the buyer picks every time; Pay says so if they haven't.

  // A failed save throws into the form, which keeps the dialog open and shows why.
  const handleSaveNewAddress = async (address: DeliveryAddress) => {
    const saved = await onAddressAdded(address);
    onAddressChange(saved);
    setShowAddressModal(false);
  };

  const hasAddresses = !!addresses?.length;

  return (
    <div className="space-y-6">
      {/* Address Selection */}
      <div className="space-y-3">
        <AddressSelector
          selectedAddress={selectedAddress}
          addresses={addresses}
          isOpen={showAddressSelector}
          onToggle={() => setShowAddressSelector(!showAddressSelector)}
          onSelect={(address) => {
            onAddressChange(address);
            setShowAddressSelector(false);
          }}
          onAddNew={() => {
            setShowAddressModal(true);
            setShowAddressSelector(false);
          }}
        />
      </div>

      {/* Address Modal */}
      {showAddressModal && (
        <AddressModal
          mode="add"
          address={{
            id: "",
            fullName: "",
            mobile: "",
            email: "",
            addressLine1: "",
            addressLine2: "",
            landmark: "",
            city: "",
            state: "",
            country: "India",
            pincode: "",
          }}
          saving={false}
          onClose={() => setShowAddressModal(false)}
          onSave={handleSaveNewAddress}
          onStartEdit={() => {}}
          onDelete={() => {}}
        />
      )}
    </div>
  );
}
