"use client";

import { useRouter } from "next/navigation";
import { Package } from "lucide-react";

import { ProfileCard } from "@/components/profile/profile-card";
import { AddressesSection } from "@/components/profile/addresses-section";
import { RecentOrdersSection } from "@/components/profile/recent-orders-section";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { useMutation } from "@/hooks/core/useMutation";
import { addressApiClient } from "@/components/profile/addressApiClient";
import { profileApiClient } from "@/components/profile/profileApiClient";
import type { DeliveryAddress, ProfileData } from "@/domain/profile";
import type { Order } from "@/domain/order";

/**
 * The three editable sections of a profile, and the writes behind them.
 *
 * A client leaf under a server page ([ADR-0034]). What it replaces is `ProfileContext`: a
 * provider mounted by the route's layout that fetched `/api/profile` on mount, held the answer
 * in state, and applied optimistic updates to it. The page above now reads the profile on the
 * server, so there is nothing to fetch and nothing to keep in sync — a write posts and calls
 * `router.refresh()`, and the server's answer is the only copy.
 */
export function ProfileSections({
  data,
  orders,
}: {
  data: ProfileData;
  orders: Order[];
}) {
  const router = useRouter();
  // Every write here ends the same way: post, surface a failure, re-read from the server.
  const { mutate: run, isLoading: saving, error } = useMutation(
    async (write: () => Promise<unknown>) => {
      await write();
    },
    { showToast: false, onSuccess: () => router.refresh() },
  );

  return (
    <div className="space-y-6">
      {error && <ErrorState message={error} />}

      <section>
        <ProfileCard
          user={data.user}
          profilePic={data.profile.profilePic}
          saving={saving}
          fallbackName="User"
          onUpdate={(input) => run(() => profileApiClient.updateProfile(input))}
          onUpdateProfilePic={(profilePic) => run(() => profileApiClient.updateProfile({ profilePic }))}
        />
      </section>

      <section>
        <AddressesSection
          addresses={data.profile.addresses}
          saving={saving}
          onSaveAddress={(address: DeliveryAddress) =>
            run(() => addressApiClient.addAddress(address))
          }
          onDeleteAddress={(addressId: string) =>
            run(() => addressApiClient.deleteAddress(addressId))
          }
        />
      </section>

      <section>
        {orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders found"
            description="You haven't placed any orders yet."
          />
        ) : (
          <RecentOrdersSection orders={orders} />
        )}
      </section>
    </div>
  );
}
