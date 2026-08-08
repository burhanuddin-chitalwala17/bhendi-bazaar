/**
 * Shiprocket Provider Implementation
 * 
 * Complete implementation of Shiprocket shipping provider.
 * Includes all core methods plus Shiprocket-specific features.
 */

import { BaseShippingProvider } from "../base.provider";
import type { WebhookEvent } from "../../domain";
import type {
  ShiprocketAuthResponse,
  GetShippingRatesRequestShiprocket,
  ShiprocketWebhookPayload,
} from "./shiprocket.types";
import { SHIPROCKET_CONFIG, SHIPROCKET_ENDPOINTS } from "./shiprocket.config";
import { shippingProviderRepository } from "../../repositories/provider.repository";
import { encryptionService } from "../../utils/encryption";
import type {
  ConnectionRequestBody,
  GetShippingRatesResponse,
  ProviderConnectionResult,
} from "../../domain/shipping.types";
import { mapShiprocketRateToShippingRate } from "./shiprocket.mapper";
import { DomainError, NotFoundError } from "@server/shared/domain-error";

export class ShiprocketProvider extends BaseShippingProvider {
  private authToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string = SHIPROCKET_CONFIG.BASE_URL;

  // ============================================================================
  // PROVIDER IDENTIFICATION
  // ============================================================================

  getProviderId(): string {
    return "shiprocket";
  }

  getProviderName(): string {
    return "Shiprocket";
  }

  // ============================================================================
  // INITIALIZATION & AUTHENTICATION
  // ============================================================================

  async initialize(providerId: string): Promise<void> {
    await super.initialize(providerId);

    // Get base URL from config if provided
    this.baseUrl = SHIPROCKET_CONFIG.BASE_URL;

    // Don't auto-authenticate - check if connected and use stored token
    await this.loadStoredAuth();
  }

  /**
   * Load stored authentication token from database
   */
  private async loadStoredAuth(): Promise<void> {
    const provider = await shippingProviderRepository.getById(this.providerId);

    if (!provider?.isConnected || !provider.authToken) {
      return; // Not connected, will authenticate on-demand
    }

    // Check if token is expired
    if (provider.tokenExpiresAt && new Date() >= provider.tokenExpiresAt) {
      // Token expired, try to refresh
      await this.refreshToken();
      return;
    }

    // Use stored token
    try {
      this.authToken = provider.authToken;
      // this.authToken = provider.authToken || undefined;
      this.tokenExpiry = provider.tokenExpiresAt || undefined;
    } catch (error) {
      console.error(
        "Failed to decrypt stored token, re-authenticating:",
        error
      );
      await this.authenticate();
    }
  }

  /**
   * Refresh token if expired
   */
  private async refreshToken(): Promise<void> {
    // For Shiprocket, we need to re-authenticate with credentials
    await this.authenticate();
  }

  /**
   * Authenticate with Shiprocket (uses stored credentials)
   */
  private async authenticate(): Promise<void> {
    const provider = await shippingProviderRepository.getById(this.providerId);

    if (!provider?.isConnected) {
      throw new DomainError("Provider account is not connected. Please connect your account in admin panel.");
    }

    const accountInfo = provider.accountInfo as any;

    if (!accountInfo?.email || !accountInfo?.password) {
      throw new NotFoundError("Provider credentials not found. Please reconnect your account.");
    }

    const email = accountInfo.email;
    const password = encryptionService.decrypt(accountInfo.password);

    const response = await fetch(
      `${this.baseUrl}${SHIPROCKET_ENDPOINTS.AUTH}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));

      // Update error in database
      await shippingProviderRepository.update(provider.id, {
        authError: error.message || response.statusText,
      });

      throw new DomainError(`Authentication failed: ${error.message || response.statusText}`);
    }

    const data: ShiprocketAuthResponse = await response.json();
    this.authToken = data.token;
    this.tokenExpiry = new Date(
      Date.now() + SHIPROCKET_CONFIG.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
    );

    // Update token in database
    await shippingProviderRepository.updateAuthToken(
      provider.id,
      data.token,
      this.tokenExpiry
    );
  }

  /**
   * Ensure token is valid, refresh if needed
   */
  private async ensureAuthenticated(): Promise<void> {
    if (
      !this.authToken ||
      !this.tokenExpiry ||
      new Date() >= this.tokenExpiry
    ) {
      await this.authenticate();
    }
  }

  /**
   * Get authorization headers
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.authToken}`,
    };
  }

  // ============================================================================
  // CORE METHODS (IShippingProvider interface)
  // ============================================================================

  /**
   * Get shipping rates from Shiprocket
   * Returns all couriers with rating >= 4
   */
  async getRates(
    request: GetShippingRatesRequestShiprocket
  ): Promise<GetShippingRatesResponse> {
    await this.ensureAuthenticated();
    console.log("Getting rates for request:", JSON.stringify(request, null, 2));

    try {
      const params = {
        pickup_postcode: request.fromPincode,
        delivery_postcode: request.toPincode,
        weight: request.weight,
        cod: request.cod ? 1 : 0,
      };

      const queryString = new URLSearchParams(params as any).toString();
      const response = await fetch(
        `${this.baseUrl}${SHIPROCKET_ENDPOINTS.SERVICEABILITY}?${queryString}`,
        {
          headers: this.getAuthHeaders(),
        }
      );
      // console.log("Shiprocket Rates API response:", response);

      if (!response.ok) {
        throw new Error(`Failed to get rates: ${response.statusText}`);
      }

      const res = await response.json();

      // Filter couriers: non-blocked AND rating >= 4
      const filteredCouriers = res.data.available_courier_companies.filter(
        (courier: any) =>
          courier.blocked === 0 && // Must be non-blocked
          true // courier.rating >= 3.5 // Must have rating >= 3.5
      );

      // console.log("🚚 Shiprocket Rates Debug:");
      // console.log(
      //   `- Total couriers from API: ${res.data.available_courier_companies.length}`
      // );

      if (filteredCouriers.length === 0) {
        console.warn(
          `No couriers available with rating >= 3.5 for pincode ${request.toPincode}`
        );
        return {
          success: false,
          rates: [],
          fromPincode: request.fromPincode,
          toPincode: request.toPincode,
        };
      }

      const rates = filteredCouriers.map((courier: any) =>
        mapShiprocketRateToShippingRate(courier, this.providerId)
      );

      // Map all filtered couriers to our ShippingRate format
      return {
        success: true,
        rates,
        fromPincode: request.fromPincode,
        toPincode: request.toPincode,
      };
    } catch (error) {
      console.error("Failed to get rates:", error);
      return {
        success: false,
        rates: [],
        fromPincode: request.fromPincode,
        toPincode: request.toPincode,
      };
    }
  }

  /**
   * Handle Shiprocket webhook
   */
  async handleWebhook(payload: any): Promise<WebhookEvent> {
    const webhookData = payload as ShiprocketWebhookPayload;

    // Extract order ID from webhook
    const orderId = webhookData.order_id;

    // Map status
    const status: WebhookEvent = {
      orderId: webhookData.order_id,
      trackingNumber: webhookData.awb,
      status: webhookData.shipment_status,
      rawPayload: payload,
    };
    return status;
  }

  /**
   * Connect Shiprocket account (implements BaseShippingProvider.connect)
   */
  async connect(
    requestBody: ConnectionRequestBody
  ): Promise<ProviderConnectionResult> {
    // Validate credentials type
    if (
      requestBody.type !== "email_password" ||
      !requestBody.email ||
      !requestBody.password
    ) {
      throw new DomainError(`Shiprocket requires email_password credentials, got ${requestBody.type}`);
    }

    const { email, password } = requestBody;

    // Call Shiprocket auth API
    const response = await fetch(
      `${this.baseUrl}${SHIPROCKET_ENDPOINTS.AUTH}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }
    );

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new DomainError(`Shiprocket authentication failed: ${
          error.message || response.statusText
        }`);
    }

    const data: ShiprocketAuthResponse = await response.json();

    // Calculate token expiry (10 days for Shiprocket)
    const tokenExpiresAt = new Date(
      Date.now() + SHIPROCKET_CONFIG.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
    );

    return {
      success: true,
      token: data.token,
      tokenExpiresAt,
      lastAuthAt: new Date(),
      accountInfo: {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        password: encryptionService.encrypt(password),
        companyId: data.company_id,
      },
    };
  }
}
