/** The words this area shows, one object per surface (ADR-0067). */

export const CONNECT_PROVIDER_MODAL_COPY = {
  apiUser: "API user",
  settingsApiConfigure: "Settings → API → Configure",
  apiUserEmail: "API user email",
  apiUserPassword: "API user password",
  cancel: "Cancel",
  connect: "Connect",
  didnTConnectCheck: "That didn't connect. Check the API user's email and password.",
} as const;

export const PROVIDER_CARD_COPY = {
  disconnect: "Disconnect",
  connectAccount: "Connect account",
  visitWebsite: "Visit website",
  connected: "Connected",
  notConnected: "Not connected",
} as const;

export const PROVIDERS_CONSOLE_COPY = {
  loadingShippingProviders: "Loading shipping providers",
  shippingProvidersDidnT: "Shipping providers didn't load",
  noShippingProvidersYet: "No shipping providers yet",
  providerRegisteredDataMigration: "A provider is registered by a data migration; once one exists, connect its account here.",
} as const;

export const PROVIDERS_API_COPY = {
  fetchFailed: "Failed to fetch providers",
  connectFailed: "Failed to connect provider",
  disconnectFailed: "Failed to disconnect provider",
} as const;

export const PROVIDERS_HOOK_COPY = {
  failed: "An error occurred",
} as const;
