"use client";

import { useState, useEffect } from "react";
import { AddressModal } from "@/components/profile/address-modal";
import { AddressSelector } from "./AddressSelector";
import { DeliveryAddress } from "@/domain/profile";

interface AuthenticatedAddressProps {
  selectedAddress: DeliveryAddress | null;
  onAddressChange: (address: DeliveryAddress) => void;
  onAddressAdded: (address: DeliveryAddress) => void;
  onAddressUpdated: (id: string, address: DeliveryAddress) => void;
  addresses: DeliveryAddress[];
}

export function AuthenticatedAddress({ 
  selectedAddress, 
  onAddressChange,
  onAddressAdded,
  onAddressUpdated, 
  addresses 
}: AuthenticatedAddressProps) {
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // No default address by decision (addresses-as-entities D3): the buyer picks,
  // every time. Nothing is auto-selected — the Continue button stays disabled until
  // they do, which is the honest version of "which address did you mean?".

  const handleSaveNewAddress = async (address: DeliveryAddress) => {
    onAddressAdded(address);
    onAddressChange(address);
    setShowAddressModal(false);
  };


  const hasAddresses = !!addresses?.length;

  return (
    <div className="space-y-6">
      {/* Address Selection */}
      <div className="space-y-3">
        <label className="text-xs font-medium uppercase tracking-eyebrow text-muted-foreground/80">
          Delivery Address
        </label>
        <AddressSelector
          selectedAddress={selectedAddress}
          addresses={addresses}
          isOpen={showAddressSelector}
          onToggle={() => setShowAddressSelector(!showAddressSelector)}
          onSelect={(address) => {
            onAddressChange(address);
            setShowAddressSelector(false); // ✅ Close selector after selection
          }}
          onAddNew={() => {
            setShowAddressModal(true);
            setShowAddressSelector(false); // ✅ Close selector when opening modal
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