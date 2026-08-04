"use client";

import { useProfileContext } from "@/context/ProfileContext";
import { useAuth } from "@/lib/auth";
import type { DeliveryAddress } from "@/domain/profile";
import { orderApiClient } from "@/services/orderApiClient";
import { ProfileCard } from "@/components/profile/profile-card";
import { AddressesSection } from "@/components/profile/addresses-section";
import { RecentOrdersSection } from "@/components/profile/recent-orders-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { useAddressManager } from "@/hooks/useAddressManager";

export default function ProfilePage() {
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";
  const router = useRouter();

  // Use context instead of hook
  const {
    user,
    profile,
    loading,
    error,
    saving,
    updateUserInfo,
    updateProfilePic,
  } = useProfileContext();

  const {
    data: orders,
    loading: ordersLoading,
    refetch,
    error: ordersError,
  } = useAsyncData(() => orderApiClient.getOrders(), {
    enabled: isAuthenticated,
    refetchDependencies: [isAuthenticated],
  });

  // use address manager
  const { addAddress, updateAddress, deleteAddress, selectAddress } = useAddressManager();

  if (loading) {
    return <LoadingSkeleton count={3} />;
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <SectionHeader
          overline="Profile"
          title="Your Bhendi Bazaar profile"
          description="Manage your account information and delivery addresses."
        />
        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Sign in to view your profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-sm text-muted-foreground">
            <p>
              Your profile hosts your saved addresses and recent orders once
              you&apos;re signed in.
            </p>
            <Button
              asChild
              className="mt-1 rounded-full px-6 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              <a href="/signin">Go to login</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        overline="Profile"
        title="Your Bhendi Bazaar profile"
        description="Manage your account information and delivery addresses."
      />
      {error && <ErrorState message={error} />}

      {/* Section 1: Primary Info */}
      <section>
        <ProfileCard
          user={user}
          profilePic={profile?.profilePic ?? ""}
          loading={loading}
          saving={saving}
          fallbackName="User"
          onUpdate={updateUserInfo}
          onUpdateProfilePic={updateProfilePic}
        />
      </section>

      {/* Section 2: Addresses */}
      <section>
        <AddressesSection
          addresses={profile?.addresses ?? []}
          loading={loading}
          saving={saving}
          onSaveAddress={addAddress}
          onDeleteAddress={deleteAddress}
          onSetDefault={(addressId) => updateAddress(addressId, { metadata: { isDefault: true } })}
        /> 
      </section>

      {/* Section 3: Recent Orders */}
      <section>
        {ordersLoading ? (
          <LoadingSkeleton count={3} />
        ) : orders && orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders found"
            description="You haven't placed any orders yet."
            action={{
              label: "View all orders",
              onClick: () => {
                router.push("/orders");
              },
            }}
          />
        ) : ordersError ? (
          <ErrorState message={ordersError} retry={refetch} />
        ) : (
          <RecentOrdersSection orders={orders ?? []} />
        )}
      </section>
    </div>
  );
}