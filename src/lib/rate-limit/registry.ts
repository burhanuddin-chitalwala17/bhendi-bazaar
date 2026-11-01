/**
 * Every public route handler, classified: limited under a policy, or exempt with a reason
 * (rate-limiting R8, D9, ADR-0063). "Public" is everything outside `/api/admin` and
 * `/api/org`, which their portal guards hold. `tests/unit/rate-limit-registry.test.ts` fails
 * a route missing here, an entry with no route, and a limited route that never calls the
 * limiter with its own key. A new route adds its line here; the budgets live in `./policies`.
 */
import { RATE_LIMIT_POLICY as P, type RateLimitPolicy } from "./policies";

type Classification =
  /** `enforcedIn` names the file that calls the limiter when it is not the route file. */
  | { readonly policy: RateLimitPolicy; readonly enforcedIn?: string }
  | { readonly exempt: string };

const PUBLIC_READ = "A public read: it shows what the pages already render, and guesses nothing.";
const OWN_READ = "The signed-in caller's own data, read-only.";

export const ROUTE_RATE_LIMITS = {
  "GET /api/addresses": { exempt: OWN_READ },
  "POST /api/addresses": { policy: P.ACCOUNT },
  "PATCH /api/addresses/[id]": { policy: P.ACCOUNT },
  "DELETE /api/addresses/[id]": { policy: P.ACCOUNT },

  "GET /api/auth/[...nextauth]": {
    exempt: "next-auth's own session, CSRF and provider reads; no secret is checked.",
  },
  // Only the credentials sign-in is counted, inside the provider, because next-auth's client
  // parses this route's own response shape (decisions Q3).
  "POST /api/auth/[...nextauth]": { policy: P.SIGN_IN, enforcedIn: "src/lib/auth-config.ts" },
  "POST /api/auth/change-password": { policy: P.AUTH },
  "POST /api/auth/forgot-password": { policy: P.AUTH },
  "POST /api/auth/resend-verification": { policy: P.AUTH },
  "POST /api/auth/reset-password": { policy: P.AUTH },
  "POST /api/auth/signup": { policy: P.AUTH },
  "GET /api/auth/verify-email": { policy: P.LOOKUP },

  "POST /api/bidding/[slug]/bids": { policy: P.BID },

  "PUT /api/cart": { policy: P.CART },
  "DELETE /api/cart": { policy: P.CART },
  "POST /api/cart/sync": { policy: P.CART },

  "GET /api/channels/[channel]/callback": {
    exempt: "The marketplace's consent redirect, once per connection; its signed state authenticates it.",
  },

  "POST /api/checkout/allocate": { policy: P.CHECKOUT },
  "POST /api/checkout/promotions/quote": { policy: P.COUPON },

  "POST /api/contact": { policy: P.MESSAGE },

  "POST /api/orders/create-with-shipments": { policy: P.ORDER },
  // A buyer's own money action (order-fulfilment D12): counted with placing an order.
  "POST /api/orders/[orderId]/shipments/[id]/cancel": { policy: P.ORDER },
  "POST /api/orders/lookup": { policy: P.LOOKUP },

  "POST /api/orgs": { policy: P.ACCOUNT },

  "POST /api/payments/abandon": { policy: P.PAYMENT },
  "POST /api/payments/confirm-free": { policy: P.PAYMENT },
  "POST /api/payments/create-order": { policy: P.PAYMENT },
  "POST /api/payments/verify": { policy: P.PAYMENT },

  "GET /api/health": {
    exempt: "The uptime monitor's probe; a limit would page us for our own budget. The deep check's database read is cached 30 s.",
  },

  "GET /api/products": { exempt: PUBLIC_READ },
  "GET /api/products/[id]/reviews": { exempt: PUBLIC_READ },
  "POST /api/products/[id]/reviews": { policy: P.ACCOUNT },
  "POST /api/products/check-stock": { policy: P.CHECKOUT },

  "GET /api/profile": { exempt: OWN_READ },
  "PUT /api/profile": { policy: P.ACCOUNT },
  "POST /api/profile/upload-picture": { policy: P.ACCOUNT },
  "DELETE /api/profile/upload-picture": { policy: P.ACCOUNT },

  "PATCH /api/reviews/[id]": { policy: P.ACCOUNT },
  "DELETE /api/reviews/[id]": { policy: P.ACCOUNT },
  "POST /api/reviews/upload-token": { policy: P.ACCOUNT },

  "GET /api/search/suggestions": { exempt: PUBLIC_READ },

  "POST /api/shipping/rates": { policy: P.CHECKOUT },

  "POST /api/webhooks/razorpay": {
    exempt: "Razorpay's signed webhook; a refused retry is a payment never recorded.",
  },
  "POST /api/webhooks/shipping/courier": {
    exempt:
      "Shiprocket sends every shipment's updates from its own few addresses, so a per-address " +
      "budget drops real updates. A shared token authenticates it (order-fulfilment D9), not a limit.",
  },

  "POST /api/wishlist": { policy: P.CART },
  "DELETE /api/wishlist": { policy: P.CART },
} as const satisfies Record<string, Classification>;

type Registry = typeof ROUTE_RATE_LIMITS;

/** A route the registry limits — the only key `limitRequest` accepts. */
export type LimitedRoute = {
  [K in keyof Registry]: Registry[K] extends { policy: RateLimitPolicy } ? K : never;
}[keyof Registry];

export function policyOf(route: LimitedRoute): RateLimitPolicy {
  return (ROUTE_RATE_LIMITS[route] as { policy: RateLimitPolicy }).policy;
}
