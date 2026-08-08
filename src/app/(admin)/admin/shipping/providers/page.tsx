// src/app/(admin)/admin/shipping/providers/page.tsx

import { Metadata } from "next";
import { ProvidersContainer } from "@/admin/shipping/providersContainer";
import { SectionHeader } from "@/components/shared/SectionHeader";

export const metadata: Metadata = {
  title: "Shipping Providers | Admin",
  description: "Manage shipping providers",
};

export default function ShippingProvidersPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <SectionHeader
        title="Shipping Providers"
        description="Manage shipping providers and their availability"
      />

      {/* Info Card */}
      <div className="bg-info/10 border border-info/30 rounded-lg p-4">
        <h3 className="font-semibold text-info mb-2">💡 How it works</h3>
        <ul className="text-sm text-info space-y-1">
          <li>• Connect your shipping provider accounts to enable them</li>
          <li>• Disconnect providers to temporarily stop using them</li>
          <li>
            • Priority determines which provider is preferred (higher = better)
          </li>
          <li>• Only connected providers will be used for shipping orders</li>
        </ul>
      </div>

      {/* Container Component */}
      <ProvidersContainer />
    </div>
  );
}
