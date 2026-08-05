/**
 * Shipping Orchestrator Service
 * 
 * Main service that coordinates all shipping operations.
 * Manages providers, rates, shipments, and tracking.
 */

import type {
  GetShippingRatesRequest,
  GetShippingRatesResponse,
  ShippingRate,
} from "../domain/shipping.types";
import type { IShippingProvider } from "../domain/provider.interface";
import { shippingProviderRepository } from "../repositories/provider.repository";
import { DomainError, NotFoundError } from "@server/shared/domain-error";

export class ShippingOrchestratorService {
  private providers: Map<string, IShippingProvider> = new Map();
  private initialized = false;
  /**
   * Load and initialize all connected providers
   * Should be called once at application startup
   */
  async loadProviders(
    providerFactories: Record<string, () => IShippingProvider>
  ): Promise<void> {
    try {
      // Get connected providers from database
      const connectedProviders =
        await shippingProviderRepository.getConnectedProviders();

      // Initialize each provider
      for (const provider of connectedProviders) {
        const factory = providerFactories[provider.code];

        if (!factory) {
          console.warn(
            `No factory found for provider: ${provider.code}. Skipping.`
          );
          continue;
        }

        try {
          const providerInstance = factory();
          await providerInstance.initialize(provider.id);
          this.providers.set(provider.code, providerInstance);

          console.log(
            `✓ Initialized shipping provider: ${providerInstance.getProviderName()}`
          );
        } catch (error) {
          console.error(
            `Failed to initialize provider ${provider.code}:`,
            error
          );
        }
      }

      this.initialized = true;
      console.log(
        `Shipping module initialized with ${this.providers.size} provider(s)`
      );
    } catch (error) {
      console.error("Failed to load shipping providers:", error);
      throw new Error("Shipping module initialization failed");
    }
  }

  /**
   * Reload a specific provider (useful after config changes)
   */
  async reloadProvider(
    providerId: string,
    factory: (config: any) => IShippingProvider
  ): Promise<void> {
    if (!providerId) {
      throw new DomainError("Provider ID is required");
    }

    const providerInstance = factory(providerId);
    await providerInstance.initialize(providerId);
    this.providers.set(providerId, providerInstance);
  }

  // ============================================================================
  // RATE CALCULATION
  // ============================================================================

  /**
   * Get rates from all enabled providers
   */
  async getRatesFromAllProviders(
    request: GetShippingRatesRequest,
    options?: {
      useCache?: boolean;
      timeout?: number;
    }
  ): Promise<GetShippingRatesResponse> {
    if (this.providers.size === 0) {
      throw new Error("No providers loaded");
    }

    const allRates: ShippingRate[] = [];

    // Get rates from each provider
    await Promise.all(
      Array.from(this.providers.entries()).map(
        async ([providerId, provider]) => {
          try {
            // Call provider API
            const response = await provider.getRates(request);
            // console.log("response", response);
            const rates = response.rates;
            allRates.push(...rates);
          } catch (error) {
            console.error(
              `Error getting rates from ${provider.getProviderName()}:`,
              error
            );
            // Continue with other providers even if one fails
          }
        }
      )
    );

    // console.log("allRates", allRates);

    const bestRates = this.getBestRatesByDeliveryDays(
      allRates as ShippingRate[]
    );

    // console.log("bestRates", bestRates);

    return {
      success: true,
      rates: bestRates,
      fromPincode: request.fromPincode,
      toPincode: request.toPincode,
      metadata: {
        totalOptions: bestRates.length,
        deliveryDays: bestRates.map((r) => r.estimatedDays),
        priceRange: {
          min: Math.min(...bestRates.map((r) => r.rate)),
          max: Math.max(...bestRates.map((r) => r.rate)),
        },
      },
    };
  }

  /**
   * Get best rates with two-step filtering:
   * 1. Group by delivery days, pick cheapest in each group
   * 2. Return winners sorted by fastest delivery
   */
  getBestRatesByDeliveryDays(rates: ShippingRate[]): ShippingRate[] {
    if (rates.length === 0) {
      return [];
    }
    // console.log("rates", rates);
    // Step 2: Filter out unavailable rates
    const availableRates = rates.filter((rate) => rate.available);

    // console.log("availableRates", availableRates);
    if (availableRates.length === 0) {
      return [];
    }

    // Step 3: Group rates by estimatedDays and find cheapest for each day
    const cheapestByDays = new Map<number, ShippingRate>();

    for (const rate of rates) {
      const days = rate.estimatedDays;
      const existingCheapest = cheapestByDays.get(days);

      // If no rate for this day yet, or current rate is cheaper, update it
      if (!existingCheapest || rate.rate < existingCheapest.rate) {
        cheapestByDays.set(days, rate);
      }
    }

    // Step 4: Convert map to array and sort by fastest delivery (days ascending)
    const winners = Array.from(cheapestByDays.values()).sort(
      (a, b) => a.estimatedDays - b.estimatedDays
    );

    return winners;
  }

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  /**
   * Handle webhook from provider
   */
  async handleWebhook(
    providerId: string,
    payload: any
  ): Promise<{
    orderId?: string;
    trackingNumber: string;
    status: any;
  }> {
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new NotFoundError(`Provider ${providerId} not found`);
    }

    return await provider.handleWebhook(payload);
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): Array<{ id: string; name: string }> {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      name: provider.getProviderName(),
    }));
  }

  /**
   * Check if a specific provider is loaded
   */
  isProviderLoaded(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * Get provider count
   */
  getProviderCount(): number {
    return this.providers.size;
  }
}

// Singleton instance
export const shippingOrchestrator = new ShippingOrchestratorService();

