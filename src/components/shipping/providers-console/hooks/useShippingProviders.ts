/**
 * useShippingProviders Hook
 * 
 * Custom hook for managing shipping providers in admin UI.
 * Provides state management and operations for provider list.
 */

import { useState, useEffect, useCallback } from "react";
import { shippingProviderService } from "@/components/shipping/providers-console/services/shippingProviderService";
import type {
  ConnectionRequestBody,
  ShippingProvider,
  ConnectionResponse,
} from "../types";

export interface UseShippingProvidersReturn {
  // Data
  providers: ShippingProvider[];

  // Loading states
  isLoading: boolean;
  isConnecting: boolean;
  isDisconnecting: boolean;

  // Error state
  error: string | null;

  // Actions
  refreshProviders: () => Promise<void>;
  connectProvider: (
    providerId: string,
    requestBody: ConnectionRequestBody
  ) => Promise<ConnectionResponse>;
  disconnectProvider: (providerId: string) => Promise<void>;
}

export function useShippingProviders(): UseShippingProvidersReturn {
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch providers from API
   */
  const refreshProviders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await shippingProviderService.getProviders();

      if (response.success) {
        setProviders(response.providers);
      } else {
        setError(response.error || "Failed to fetch providers");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Connect a provider account
   */
  const connectProvider = useCallback(
    async (
      providerId: string,
      requestBody: ConnectionRequestBody
    ): Promise<ConnectionResponse> => {
      setIsConnecting(true);
      setError(null);

      try {
        const response = await shippingProviderService.connectProvider(
          providerId,
          requestBody
        );
        if (response.success) {
          setProviders((prev) =>
            prev.map((provider) =>
              provider.id === providerId
                ? {
                    ...provider,
                    accountInfo: response.provider?.accountInfo,
                    lastAuthAt: response.provider?.lastAuthAt,
                    connectedBy: response.provider?.connectedBy,
                    isConnected: true,
                  }
                : provider
            )
          );
          return response;
        } else {
          setError(response.error || "Failed to connect provider");
          return response;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        return {
          success: false,
          error: err instanceof Error ? err.message : "An error occurred",
        };
      } finally {
        setIsConnecting(false);
      }
    },
    []
  );

  /**
   * Disconnect a provider account
   */
  const disconnectProvider = useCallback(async (providerId: string) => {
    setIsDisconnecting(true);
    setError(null);
    try {
      const response = await shippingProviderService.disconnectProvider(
        providerId
      );
      if (response.success) {
        setProviders((prev) =>
          prev.map((provider) =>
            provider.id === providerId
              ? {
                  ...provider,
                  accountInfo: response.provider?.accountInfo,
                  lastAuthAt: response.provider?.lastAuthAt,
                  connectedBy: response.provider?.connectedBy,
                  isConnected: false,
                }
              : provider
          )
        );
      } else {
        setError(response.error || "Failed to disconnect provider");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  return {
    providers,
    isLoading,
    isConnecting,
    isDisconnecting,
    error,
    refreshProviders,
    connectProvider,
    disconnectProvider,
  };
}

