/** The one product the journeys buy. Fixed keys, so a rerun reuses it rather than leaking rows. */
export const E2E_PRODUCT = {
  slug: "e2e-smoke-attar",
  name: "E2E Smoke Attar",
  sku: "E2E-SMOKE-ATTAR",
  pricePaise: 49_900,
  stock: 1_000,
} as const;

/** A signed-in buyer for the account journeys. A throwaway password on a throwaway database. */
export const E2E_BUYER = {
  email: "e2e-buyer@example.invalid",
  password: "E2e-Buyer-Passw0rd!",
  name: "E2E Buyer",
} as const;
