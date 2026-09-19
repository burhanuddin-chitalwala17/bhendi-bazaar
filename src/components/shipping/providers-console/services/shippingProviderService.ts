/**
 * Client-Side Shipping Service
 *
 * Service layer for making API calls related to shipping.
 * Used by hooks and components to communicate with backend.
 */

import type {
  GetProvidersResponse,
  ConnectionRequestBody,
  ConnectionResponse,
} from "@/components/shipping/providers-console/types";

export class ShippingProviderService {
  /**
   * Get all shipping providers (Admin)
   */
  async getProviders(): Promise<GetProvidersResponse> {
    try {
      const response = await fetch("/api/admin/shipping/providers", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch providers");
      }

      return data;
    } catch (error) {
      console.error("ShippingService.getProviders error:", error);
      return {
        success: false,
        providers: [],
        error:
          error instanceof Error ? error.message : "Failed to fetch providers",
      };
    }
  }

  /**
   * Connect a provider account
   */
  async connectProvider(
    providerId: string,
    requestBody: ConnectionRequestBody,
  ): Promise<ConnectionResponse> {
    try {
      const response = await fetch(
        `/api/admin/shipping/providers/${providerId}/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );

      const data = await response.json();

      if (!response) {
        throw new Error(data.error || "Failed to connect provider");
      }

      return data;
    } catch (error) {
      console.error("ShippingService.connectProvider error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to connect provider",
      };
    }
  }

  /**
   * Disconnect a provider account
   */
  async disconnectProvider(providerId: string): Promise<ConnectionResponse> {
    try {
      const response = await fetch(
        `/api/admin/shipping/providers/${providerId}/disconnect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect provider");
      }

      return data;
    } catch (error) {
      console.error("ShippingService.disconnectProvider error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to disconnect provider",
      };
    }
  }
}

// Singleton instance
export const shippingProviderService = new ShippingProviderService();
