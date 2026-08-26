/**
 * Base Shipping Provider
 *
 * Abstract base class that provides common functionality for all shipping providers.
 * Implements the IShippingProvider interface with shared utilities.
 */

import type { IShippingProvider } from "../domain/provider.interface";
import type {
  ConnectionRequestBody,
  CreateShipmentRequest,
  CreateShipmentResult,
  GetShippingRatesRequest,
  GetShippingRatesResponse,
  ProviderConnectionResult,
} from "../domain/shipping.types";

export abstract class BaseShippingProvider implements IShippingProvider {
  protected providerId!: string;
  protected initialized = false;

  // ============================================================================
  // ABSTRACT METHODS (Must be implemented by subclasses)
  // ============================================================================

  /**
   * Connect provider account with credentials
   * Each provider implements their own connection logic
   * @param credentials Provider-specific credentials
   * @returns Connection result with token and account info
   */
  abstract connect(
    requestBody: ConnectionRequestBody
  ): Promise<ProviderConnectionResult>;

  abstract getProviderId(): string;
  abstract getProviderName(): string;
  abstract getRates(
    request: GetShippingRatesRequest
  ): Promise<GetShippingRatesResponse>;
  abstract createShipment(
    request: CreateShipmentRequest
  ): Promise<CreateShipmentResult>;
  abstract handleWebhook(payload: any): Promise<any>;

  // ============================================================================
  // LIFECYCLE METHODS
  // ============================================================================

  /**
   * Initialize provider
   */
  async initialize(providerId: string): Promise<void> {
    this.providerId = providerId;
    this.initialized = true;
  }
}
