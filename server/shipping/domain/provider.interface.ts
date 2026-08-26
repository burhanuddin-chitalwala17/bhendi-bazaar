/**
 * IShippingProvider Interface
 * 
 * This interface defines the contract that all shipping providers must implement.
 * It ensures consistent behavior across different providers (Shiprocket, Delhivery, etc.)
 */

import type {
  CreateShipmentRequest,
  CreateShipmentResult,
  GetShippingRatesRequest,
  GetShippingRatesResponse,
  ShippingRate,
  WebhookEvent,
} from "./shipping.types";

export interface IShippingProvider {
  // ============================================================================
  // IDENTIFICATION
  // ============================================================================

  /**
   * Get unique provider identifier
   * @returns Provider code (e.g., 'shiprocket', 'delhivery')
   */
  getProviderId(): string;

  /**
   * Get human-readable provider name
   * @returns Provider name (e.g., 'Shiprocket', 'Delhivery')
   */
  getProviderName(): string;

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Initialize provider with configuration
   * Called once when provider is loaded
   * @param config Provider configuration including API credentials
   */
  initialize(providerId: string): Promise<void>;

  // ============================================================================
  // RATE CALCULATION
  // ============================================================================

  /**
   * Get available shipping rates
   * May return multiple rates for different courier services
   * @param request Rate calculation parameters
   * @returns Array of available shipping rates
   */
  getRates(request: GetShippingRatesRequest): Promise<GetShippingRatesResponse>;

  // ============================================================================
  // BOOKING
  // ============================================================================

  /**
   * Book a real shipment with the courier and obtain a tracking reference.
   * @param request What to book, including the idempotency key (D5)
   */
  createShipment(request: CreateShipmentRequest): Promise<CreateShipmentResult>;

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  /**
   * Handle webhook callback from provider
   * @param payload Raw webhook payload from provider
   * @returns Normalized webhook event
   */
  handleWebhook(payload: any): Promise<WebhookEvent>;

  /**
   * Validate webhook signature (optional but recommended)
   * @param payload Webhook payload
   * @param signature Signature from webhook headers
   * @returns true if signature is valid
   */
  validateWebhook?(payload: any, signature: string): boolean;
}

/**
 * Provider Factory Type
 * Used to create provider instances
 */
export type ProviderFactory = () => IShippingProvider;

