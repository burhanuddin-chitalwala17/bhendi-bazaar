// src/server/services/admin/shipping/connection/service.ts

/**
 * Admin Connection Service
 * 
 * Admin layer for connecting shipping providers.
 * Delegates actual connection logic to shipping providers.
 */

import { shippingProviderRepository } from "@server/shipping/repositories";
import { PROVIDER_FACTORIES } from "@server/shipping";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import type {
  ProviderConnectionResult,
  ConnectionRequestBody,
} from "@server/shipping/domain/shipping.types";
import type { AdminConnectionResult } from "@server/shipping/services/connection.types";
import { DomainError, NotFoundError } from "@server/shared/domain-error";

/**
 * The carrier's result carries the live token and the encrypted password, because the
 * repository needs them. The console does not: it learns connection state and the account's
 * email, nothing that could be replayed against the carrier (shipping ADR-0002 D3).
 */
export function toAdminConnectionResult(result: ProviderConnectionResult): AdminConnectionResult {
  const account = { ...result.accountInfo };
  delete account.password;
  return {
    success: result.success,
    ...(result.error !== undefined && { error: result.error }),
    ...(result.lastAuthAt !== undefined && { lastAuthAt: result.lastAuthAt }),
    ...(result.accountInfo !== undefined && { accountInfo: account }),
  };
}

export class AdminConnectionService {
  /**
   * Connect a provider account (Admin operation)
   */
  async connect(
    providerId: string,
    requestBody: ConnectionRequestBody,
    adminId: string
  ): Promise<AdminConnectionResult> {
    // 1. Validate provider exists
    const provider = await shippingProviderRepository.findSummaryById(providerId);
    if (!provider) {
      throw new NotFoundError("Provider not found");
    }

    // 2. Get provider factory and create instance
    const factory =
      PROVIDER_FACTORIES[provider.code as keyof typeof PROVIDER_FACTORIES];

    if (!factory) {
      throw new NotFoundError(`Provider implementation not found: ${provider.code}`);
    }
    let connectionResult: ProviderConnectionResult;

    try {
      const providerInstance = factory();

      switch (requestBody.type) {
        case "email_password": {
          connectionResult = await providerInstance.connect(requestBody);
          await shippingProviderRepository.update(providerId, {
            isConnected: true,
            connectedAt: new Date(),
            connectedBy: "admin",
            authToken: connectionResult.token,
            tokenExpiresAt: connectionResult.tokenExpiresAt,
            lastAuthAt: new Date(),
            authError: null,
            accountInfo: {
              id: connectionResult.accountInfo?.id,
              firstName: connectionResult.accountInfo?.firstName,
              lastName: connectionResult.accountInfo?.lastName,
              email: connectionResult.accountInfo?.email,
              password: connectionResult.accountInfo?.password,
              companyId: connectionResult.accountInfo?.companyId,
            },
          });
          break;
        }
        default:
          throw new DomainError(`Unsupported connection type: ${requestBody.type}`);
      }
      if (connectionResult.success) {
        // The credentials are stored, but the running process still holds the
        // provider map it built at boot. Load the carrier into it now, or quoting
        // keeps returning "no providers" until someone restarts the server —
        // which would make connecting-without-a-deploy (ADR-0002) untrue.
        //
        // A failure here has not undone the connection, so it must not fail the
        // request: the next initialize retries, now that the record is connected.
        try {
          const { shippingOrchestrator } = await import(
            "@server/shipping/services/orchestrator.service"
          );
          await shippingOrchestrator.refreshProvider(
            provider.code,
            providerId,
            factory
          );
        } catch (error) {
          console.error(
            `[connect] ${provider.code} stored but not loaded into the running orchestrator — it will load on the next initialize`,
            error
          );
        }

        // 6. Log admin action
        await recordAdminAction({
          adminId,
          action: "PROVIDER_CONNECTED",
          resource: "ShippingProvider",
          resourceId: providerId,
          metadata: {
            providerCode: provider.code,
            accountInfo: toAdminConnectionResult(connectionResult).accountInfo,
          },
        });
      } else {
        await recordAdminAction({
          adminId,
          action: "PROVIDER_CONNECTION_FAILED",
          resource: "ShippingProvider",
          resourceId: providerId,
          metadata: {
            providerCode: provider.code,
            error: connectionResult.error,
          },
        });
      }
      return toAdminConnectionResult(connectionResult);
    } catch (error) {
      await recordAdminAction({
        adminId,
        action: "PROVIDER_CONNECTION_FAILED",
        resource: "ShippingProvider",
        resourceId: providerId,
        metadata: {
          providerCode: provider.code,
          error: error instanceof Error ? error.message : "Connection failed",
        },
      });

      throw error;
    }
  }

  /**
   * Disconnect a provider account (Admin operation)
   */
  async disconnect(
    providerId: string,
    adminId: string
  ): Promise<{ success: boolean; error?: string }> {
    const provider = await shippingProviderRepository.findSummaryById(providerId);
    if (!provider) {
      throw new NotFoundError("Provider not found");
    }

    if (!provider.isConnected) {
      throw new DomainError("Provider is not connected");
    }

    const result = await shippingProviderRepository.disconnectAccount(
      providerId
    );

    if (!result) {
      throw new Error("Failed to disconnect provider");
    }

    // Same reasoning as connect: the record says disconnected, so the live map
    // must stop quoting it rather than keep using the token until a restart.
    const { shippingOrchestrator } = await import(
      "@server/shipping/services/orchestrator.service"
    );
    shippingOrchestrator.removeProvider(provider.code);

    await recordAdminAction({
      adminId,
      action: "PROVIDER_DISCONNECTED",
      resource: "ShippingProvider",
      resourceId: providerId,
      metadata: {
        providerCode: provider.code,
      },
    });
    return result;
  }
}

// Singleton instance
export const adminConnectionService = new AdminConnectionService();