/**
 * Admin Shipping Service
 *
 * What the providers console reads. Every provider here is a `ShippingProviderSummary`:
 * the repository never hands this service a credential (shipping ADR-0002 D3).
 */

import {
  shippingProviderRepository,
  type ShippingProviderSummary,
} from "@server/shipping/repositories";

export interface GetProvidersResponse {
  success: boolean;
  providers: ShippingProviderSummary[];
  error?: string;
}

export interface GetProviderByIdResponse {
  success: boolean;
  provider?: ShippingProviderSummary;
  error?: string;
}
export class AdminShippingService {
  async getAllProviders(): Promise<GetProvidersResponse> {
    const providers = await shippingProviderRepository.listSummaries();
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

  async getProviderById(
    providerId: string
  ): Promise<GetProviderByIdResponse | null> {
    const provider = await shippingProviderRepository.findSummaryById(providerId);

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
