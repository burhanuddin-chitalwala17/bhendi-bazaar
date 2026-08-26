// src/server/services/admin/shipping/connection/service.ts

/**
 * Admin Connection Service
 * 
 * Admin layer for connecting shipping providers.
 * Delegates actual connection logic to shipping providers.
 */

import { shippingProviderRepository } from "@server/shipping/repositories";
import { PROVIDER_FACTORIES } from "@server/shipping";
import { adminLogRepository } from "@server/shared/audit/audit.repository";
import { toSafeAccountInfo } from "@server/shipping/utils/safe-provider";
import type {
  ProviderConnectionResult,
  ConnectionRequestBody,
} from "@server/shipping/domain/shipping.types";
import type { AdminConnectionResult } from "@server/shipping/services/connection.types";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
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
    const provider = await shippingProviderRepository.getById(providerId);
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
        // 6. Log admin action
        await adminLogRepository.createLog({
          adminId,
          action: "PROVIDER_CONNECTED",
          resource: "ShippingProvider",
          resourceId: providerId,
          metadata: {
            providerCode: provider.code,
            accountInfo: toSafeAccountInfo(connectionResult.accountInfo),
          },
        });
      } else {
        await adminLogRepository.createLog({
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
      // `connectionResult` still carries the live carrier bearer token (`token`) —
      // a caller further out serialises this straight into an HTTP response, so
      // building the safe shape here, rather than trusting the AdminConnectionResult
      // return type to have stripped it, is what actually keeps it off the wire.
      const safeResult: AdminConnectionResult = {
        success: connectionResult.success,
        error: connectionResult.error,
        tokenExpiresAt: connectionResult.tokenExpiresAt,
        lastAuthAt: connectionResult.lastAuthAt,
        connectedBy: "admin",
        accountInfo: toSafeAccountInfo(connectionResult.accountInfo) ?? undefined,
      };
      return safeResult;
    } catch (error) {
      await adminLogRepository.createLog({
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
    const provider = await shippingProviderRepository.getById(providerId);
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

    await adminLogRepository.createLog({
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