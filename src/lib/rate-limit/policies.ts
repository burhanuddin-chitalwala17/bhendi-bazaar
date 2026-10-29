/**
 * The closed set of rate-limit policies and their budgets — the only place a number lives.
 * A handler names its route in `./registry`, never a budget (rate-limiting D9, decisions Q2–Q8).
 */
export const RATE_LIMIT_POLICY = {
  AUTH: "auth",
  SIGN_IN: "sign-in",
  LOOKUP: "lookup",
  COUPON: "coupon",
  PAYMENT: "payment",
  ORDER: "order",
  CHECKOUT: "checkout",
  CART: "cart",
  BID: "bid",
  MESSAGE: "message",
  ACCOUNT: "account",
} as const;

export type RateLimitPolicy = (typeof RATE_LIMIT_POLICY)[keyof typeof RATE_LIMIT_POLICY];

/** Requests allowed per window, per route and caller (decisions Q10). */
export interface Budget {
  requests: number;
  windowSeconds: number;
}

const MINUTE = 60;

export const POLICY_BUDGETS: Record<RateLimitPolicy, Budget> = {
  [RATE_LIMIT_POLICY.AUTH]: { requests: 5, windowSeconds: 15 * MINUTE },
  [RATE_LIMIT_POLICY.SIGN_IN]: { requests: 10, windowSeconds: 15 * MINUTE },
  [RATE_LIMIT_POLICY.LOOKUP]: { requests: 10, windowSeconds: 15 * MINUTE },
  [RATE_LIMIT_POLICY.COUPON]: { requests: 20, windowSeconds: 15 * MINUTE },
  [RATE_LIMIT_POLICY.PAYMENT]: { requests: 10, windowSeconds: MINUTE },
  [RATE_LIMIT_POLICY.ORDER]: { requests: 20, windowSeconds: MINUTE },
  [RATE_LIMIT_POLICY.CHECKOUT]: { requests: 60, windowSeconds: MINUTE },
  [RATE_LIMIT_POLICY.CART]: { requests: 100, windowSeconds: MINUTE },
  [RATE_LIMIT_POLICY.BID]: { requests: 20, windowSeconds: MINUTE },
  [RATE_LIMIT_POLICY.MESSAGE]: { requests: 5, windowSeconds: 10 * MINUTE },
  [RATE_LIMIT_POLICY.ACCOUNT]: { requests: 30, windowSeconds: MINUTE },
};
