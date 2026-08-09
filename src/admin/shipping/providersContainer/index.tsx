// src/components/admin/shipping/ProvidersContainer.tsx

"use client";

import { useShippingProviders } from "@/admin/shipping/providersContainer/hooks/useShippingProviders";
import { ProviderCard } from "./component/ProviderCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    requestBody: ConnectionRequestBody
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

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-1/4 mb-2" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && providers.length === 0) {
    return (
      <Card className="p-8 text-center border-destructive/30 bg-destructive/10">
        <p className="text-destructive font-semibold mb-2">
          Failed to load providers
        </p>
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button onClick={refreshProviders} variant="outline">
          Try Again
        </Button>
      </Card>
    );
  }

  // Empty state
  if (providers.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-2">
            No shipping providers configured yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Contact your developer to set up shipping providers.
          </p>
        </Card>
      </div>
    );
  }

  // Providers list
  return (
    <>
      <div className="space-y-4">
        {/* Error banner (if any, but providers exist) */}
        {error && (
          <Card className="p-4 border-warning/30 bg-warning/10">
            <p className="text-sm text-warning">{error}</p>
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