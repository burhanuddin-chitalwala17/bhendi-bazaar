/**
 * ShippingProvider Repository
 *
 * Two shapes leave here, and the name of each method says which. A *summary* is what the
 * admin console sees: identity, connection state, capabilities. Credentials are read only
 * through `findWithCredentials`, by the carrier that has to authenticate with them
 * (shipping ADR-0002 D3; `tests/unit/provider-dto.test.ts`).
 */

import { prisma } from "@server/shared/prisma";
import type { ShippingProvider, Prisma } from "@prisma/client";
import { encryptSecret } from "@server/shared/crypto";

/** The columns a browser may never see. Named once, so the test and the projection agree. */
export const PROVIDER_CREDENTIAL_FIELDS = [
  "authToken",
  "tokenExpiresAt",
  "accountInfo",
  "authError",
] as const satisfies readonly (keyof ShippingProvider)[];

/** Everything about a carrier that is not a credential. */
export const PROVIDER_SUMMARY_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  priority: true,
  isConnected: true,
  connectedAt: true,
  connectedBy: true,
  connectionType: true,
  lastAuthAt: true,
  paymentOptions: true,
  deliveryModes: true,
  features: true,
  logoUrl: true,
  websiteUrl: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ShippingProviderSelect;

/**
 * The summary read pulls `accountInfo` so the console can show which account is connected,
 * and `toProviderSummary` keeps the address and drops the rest — the encrypted password
 * lives in the same JSON column.
 */
const SUMMARY_ROW_SELECT = {
  ...PROVIDER_SUMMARY_SELECT,
  accountInfo: true,
} as const satisfies Prisma.ShippingProviderSelect;

type SummaryRow = Prisma.ShippingProviderGetPayload<{ select: typeof SUMMARY_ROW_SELECT }>;

export type ShippingProviderSummary = Prisma.ShippingProviderGetPayload<{
  select: typeof PROVIDER_SUMMARY_SELECT;
}> & {
  /** The connected account's login email, when there is one. Never the password beside it. */
  accountInfo?: { email: string };
};

/** The email in a provider's `accountInfo`, or nothing. */
export function connectedAccountEmail(accountInfo: Prisma.JsonValue | null | undefined): string | null {
  if (!accountInfo || typeof accountInfo !== "object" || Array.isArray(accountInfo)) return null;
  const email = (accountInfo as Record<string, unknown>).email;
  return typeof email === "string" && email ? email : null;
}

/** Picks by the select's keys rather than spreading, so a wider row cannot carry anything extra through. */
export function toProviderSummary(row: SummaryRow): ShippingProviderSummary {
  const summary = Object.fromEntries(
    Object.keys(PROVIDER_SUMMARY_SELECT).map((key) => [key, row[key as keyof typeof PROVIDER_SUMMARY_SELECT]]),
  ) as ShippingProviderSummary;
  const email = connectedAccountEmail(row.accountInfo);
  return email ? { ...summary, accountInfo: { email } } : summary;
}

export class ShippingProviderRepository {
  // ============================================================================
  // SUMMARIES — safe to send to a browser
  // ============================================================================

  /** Connected carriers, highest priority first. */
  async getConnectedProviders(): Promise<ShippingProviderSummary[]> {
    const rows = await prisma.shippingProvider.findMany({
      where: { isConnected: true },
      orderBy: { priority: "desc" },
      select: SUMMARY_ROW_SELECT,
    });
    return rows.map(toProviderSummary);
  }

  /** Every carrier, connected or not. */
  async listSummaries(): Promise<ShippingProviderSummary[]> {
    const rows = await prisma.shippingProvider.findMany({
      orderBy: { priority: "desc" },
      select: SUMMARY_ROW_SELECT,
    });
    return rows.map(toProviderSummary);
  }

  async findSummaryById(id: string): Promise<ShippingProviderSummary | null> {
    const row = await prisma.shippingProvider.findUnique({
      where: { id },
      select: SUMMARY_ROW_SELECT,
    });
    return row ? toProviderSummary(row) : null;
  }

  /** Id and code only: a webhook needs to know the carrier is configured, not its credentials. */
  async findIdentityByCode(code: string): Promise<{ id: string; code: string } | null> {
    return await prisma.shippingProvider.findUnique({
      where: { code },
      select: { id: true, code: true },
    });
  }

  // ============================================================================
  // CREDENTIALS — for the carrier's own auth path, never for a response
  // ============================================================================

  /** The whole row, `authToken` and `accountInfo` included. */
  async findWithCredentials(id: string): Promise<ShippingProvider | null> {
    return await prisma.shippingProvider.findUnique({
      where: { id },
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
   * Connect provider account (store encrypted credentials)
   */
  async connectAccount(
    id: string,
    data: {
      email: string;
      password: string; // Plain password (will be encrypted)
      authToken: string; // Plain token (will be encrypted)
      tokenExpiresAt: Date;
      accountInfo: any;
      connectedBy: string; // Admin user ID
    }
  ): Promise<ShippingProvider> {
    return await prisma.shippingProvider.update({
      where: { id },
      data: {
        isConnected: true,
        connectedAt: new Date(),
        connectedBy: data.connectedBy,
        lastAuthAt: new Date(),
        authError: null,
        authToken: data.authToken,
        tokenExpiresAt: data.tokenExpiresAt,
        accountInfo: {
          ...data.accountInfo,
          password: encryptSecret(data.password),
        },
      },
    });
  }

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
