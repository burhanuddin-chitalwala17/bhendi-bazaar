/**
 * ShippingProvider Repository
 * 
 * Handles all database operations for the ShippingProvider model.
 * Manages provider configuration, enablement, and queries.
 */

import { prisma } from "@server/shared/prisma";
import type { ShippingProvider, Prisma } from "@prisma/client";
export class ShippingProviderRepository {
  // ============================================================================
  // QUERY OPERATIONS
  // ============================================================================

  /**
   * Get all enabled providers ordered by priority (highest first)
   */
  async getConnectedProviders(): Promise<ShippingProvider[]> {
    return await prisma.shippingProvider.findMany({
      where: { isConnected: true },
      orderBy: { priority: "desc" },
    });
  }

  /**
   * Get all providers (connected and disconnected)
   */
  async getAllProviders(): Promise<ShippingProvider[]> {
    return await prisma.shippingProvider.findMany({
      orderBy: { priority: "desc" },
    });
  }

  /**
   * Get provider by unique code
   */
  async getByCode(code: string): Promise<ShippingProvider | null> {
    return await prisma.shippingProvider.findUnique({
      where: { code },
    });
  }

  /**
   * Get provider by ID
   */
  async getById(id: string): Promise<ShippingProvider | null> {
    return await prisma.shippingProvider.findUnique({
      where: { id },
    });
  }

  /**
   * Get providers that support a specific shipping mode
   */
  async getProvidersByMode(mode: string): Promise<ShippingProvider[]> {
    return await prisma.shippingProvider.findMany({
      where: {
        isConnected: true,
        deliveryModes: {
          hasSome: [mode],
        },
      },
      orderBy: { priority: "desc" },
    });
  }

  // ============================================================================
  // UPDATE OPERATIONS
  // ============================================================================

  /**
   * Update provider configuration
   */
  async update(
    id: string,
    data: Prisma.ShippingProviderUpdateInput
  ): Promise<ShippingProvider> {
    return await prisma.shippingProvider.update({
      where: { id },
      data,
    });
  }

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Disconnect provider account (clear all auth data)
   */
  async disconnectAccount(
    id: string
  ): Promise<{ success: boolean; error?: string }> {
    const response = await prisma.shippingProvider.update({
      where: { id },
      data: {
        isConnected: false,
        connectedAt: null,
        connectedBy: null,
        authError: null,
        authToken: null,
        tokenExpiresAt: null,
        accountInfo: null as any,
      },
    });
    if (!response) {
      return { success: false, error: "Failed to disconnect provider" };
    }
    return { success: true, error: undefined };
  }

  /**
   * Update auth token (for refresh)
   */
  async updateAuthToken(
    id: string,
    token: string,
    expiresAt: Date
  ): Promise<ShippingProvider> {
    return await prisma.shippingProvider.update({
      where: { id },
      data: {
        authToken: token,
        tokenExpiresAt: expiresAt,
        lastAuthAt: new Date(),
        authError: null,
      },
    });
  }
}



// Singleton instance
export const shippingProviderRepository = new ShippingProviderRepository();
