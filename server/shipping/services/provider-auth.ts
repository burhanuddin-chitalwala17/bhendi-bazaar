/**
 * Provider Authentication Helper
 * 
 * Abstracts provider-specific authentication logic.
 * Each provider can implement its own auth method.
 */

import type { IShippingProvider } from "@server/shipping/domain";

export interface ProviderAuthResult {
  token: string;
  expiresAt: Date;
  accountInfo: {
    email: string;
    firstName: string;
    lastName: string;
    companyId: number;
  };
}

/**
 * Authenticate with a provider using credentials
 */
export async function authenticateProvider(
  providerInstance: IShippingProvider,
  email: string,
  password: string
): Promise<ProviderAuthResult> {
  const providerId = providerInstance.getProviderId();
  
  // Route to provider-specific auth
  switch (providerId) {
    case "shiprocket":
      return await authenticateShiprocket(email, password);
    default:
      throw new Error(`Authentication not implemented for provider: ${providerId}`);
  }
}

/**
 * Shiprocket-specific authentication
 */
async function authenticateShiprocket(
  email: string,
  password: string
): Promise<ProviderAuthResult> {
  const response = await fetch(
    "https://apiv2.shiprocket.in/v1/external/auth/login",
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
    throw new Error(
      `Authentication failed: ${error.message || response.statusText}`
    );
  }

  const data = await response.json();

  return {
    token: data.token,
    expiresAt: new Date(Date.now() + 240 * 60 * 60 * 1000), // 10 days
    accountInfo: {
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      companyId: data.company_id,
    },
  };
}