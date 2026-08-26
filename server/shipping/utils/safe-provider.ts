import type { ShippingProvider } from "@prisma/client";

/**
 * Never send `authToken` (a live carrier bearer credential) or a stored password
 * to a client, encrypted or not (ADR-0002 rule 3). `email`/name/companyId inside
 * accountInfo are shown in the admin UI ("connected as ...") and stay.
 */
export function toSafeAccountInfo(
  accountInfo: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!accountInfo) return null;
  const { password: _password, ...rest } = accountInfo;
  return rest;
}

export type SafeShippingProvider = Omit<
  ShippingProvider,
  "authToken" | "authError" | "accountInfo"
> & { accountInfo: Record<string, unknown> | null };

export function toSafeProvider(provider: ShippingProvider): SafeShippingProvider {
  const { authToken: _authToken, authError: _authError, accountInfo, ...rest } = provider;
  return { ...rest, accountInfo: toSafeAccountInfo(accountInfo as Record<string, unknown> | null) };
}
