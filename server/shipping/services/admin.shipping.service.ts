/**
 * Admin Shipping Service
 * 
 * Server-side service for managing shipping providers (Admin operations).
 * Business logic layer between API routes and repositories.
 */

import { shippingProviderRepository } from "@server/shipping/repositories";
import type { ShippingProvider } from "@prisma/client";

export interface GetProvidersResponse {
  success: boolean;
  providers: ShippingProvider[];
  error?: string;
}

export interface GetProviderByIdResponse {
  success: boolean;
  provider?: ShippingProvider;
  error?: string;
}
export class AdminShippingService {
  /**
   * Get all providers (safe for admin view - no sensitive config)
   */
  async getAllProviders(): Promise<GetProvidersResponse> {
    const providers = await shippingProviderRepository.getAllProviders();
    if (providers.length === 0) {
      return {
        success: false,
        providers,
        error: "No providers found",
      };
    }
    return {
      success: true,
      providers,
    };
  }

  /**
   * Get provider by ID (safe summary)
   */
  async getProviderById(
    providerId: string
  ): Promise<GetProviderByIdResponse | null> {
    const provider = await shippingProviderRepository.getById(providerId);

    if (!provider) {
      return {
        success: false,
        error: "Provider not found",
      };
    } else {
      return {
        success: true,
        provider,
      };
    }
  }
}

// Singleton instance
export const adminShippingService = new AdminShippingService();

