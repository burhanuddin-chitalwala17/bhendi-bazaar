"use client";

import { useShippingProviders } from "@/components/shipping/providers-console/hooks/useShippingProviders";
import { ProviderCard } from "./component/ProviderCard";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { SkeletonTiles } from "@/components/shared/states/skeletons";
import { useState } from "react";
import { ConnectProviderModal } from "./component/ConnectProviderModal";
import type { ConnectionRequestBody } from "./types";
/**
 * Container Component
 *
 * Manages all state, business logic, and coordinates between:
 * - Hook (data fetching & mutations)
 * - Service layer (API calls)
 * - Presentational components (Cards)
 */
export function ProvidersContainer() {
  const {
    providers,
    isLoading,
    isConnecting,
    isDisconnecting,
    error,
    refreshProviders,
    connectProvider,
    disconnectProvider,
  } = useShippingProviders();

  // Modal state
  const [connectModalState, setConnectModalState] = useState<{
    open: boolean;
    providerId: string | null;
    providerName: string | null;
  }>({
    open: false,
    providerId: null,
    providerName: null,
  });

  // Handlers
  const handleOpenConnectModal = (providerId: string, providerName: string) => {
    setConnectModalState({
      open: true,
      providerId,
      providerName,
    });
  };

  const handleCloseConnectModal = () => {
    setConnectModalState({
      open: false,
      providerId: null,
      providerName: "",
    });
  };

  const handleConnect = async (
    providerId: string,
    requestBody: ConnectionRequestBody,
  ) => {
    if (requestBody.type === "email_password") {
      const provider = providers.find((p) => p.id === providerId);
      if (!provider) return false;
      handleOpenConnectModal(providerId, provider.name);
    } else {
      connectProvider(providerId, requestBody);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    await disconnectProvider(providerId);
  };

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading shipping providers">
        <SkeletonTiles count={3} />
      </div>
    );
  }

  if (error && providers.length === 0) {
    return (
      <ErrorState
        title="Shipping providers didn't load"
        description={error}
        onRetry={refreshProviders}
      />
    );
  }

  if (providers.length === 0) {
    return (
      <EmptyState
        title="No shipping providers yet"
        description="A provider is registered by a data migration; once one exists, connect its account here."
      />
    );
  }

  // Providers list
  return (
    <>
      <div className="space-y-4">
        {/* Error banner (if any, but providers exist) */}
        {error && (
          <Card className="p-4 border-warning/30 bg-warning/10">
            <p className="text-small text-warning">{error}</p>
          </Card>
        )}

        {/* Providers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.length > 0 &&
            providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onConnect={() =>
                  handleConnect(provider.id, {
                    type: provider.connectionType,
                  })
                }
                onDisconnect={() => handleDisconnect(provider.id)}
                isConnecting={isConnecting}
                isDisconnecting={isDisconnecting}
              />
            ))}
        </div>
      </div>

      {/* Connect Modal */}
      {connectModalState.providerId && (
        <ConnectProviderModal
          providerId={connectModalState.providerId}
          providerName={connectModalState.providerName ?? ""}
          open={connectModalState.open}
          onClose={handleCloseConnectModal}
          onConnect={connectProvider}
          isConnecting={isConnecting}
        />
      )}
    </>
  );
}
