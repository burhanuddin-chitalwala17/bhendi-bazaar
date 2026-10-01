import { toast } from "sonner";

import { wishlistApiClient } from "@/components/wishlist/wishlistApiClient";

/**
 * What a shopper was doing when asked to sign in, finished once they have
 * (seamless-sign-in D6–D8). Named and serialisable, never a closure, because the
 * Google round trip leaves the page. Every kind must be idempotent: the heart's
 * intent is a save, never its toggle.
 */
export type AuthIntent = { kind: "wishlist.save"; productId: string };

const HANDLERS: { [K in AuthIntent["kind"]]: (intent: Extract<AuthIntent, { kind: K }>) => Promise<void> } = {
  "wishlist.save": async ({ productId }) => {
    await wishlistApiClient.save(productId);
    toast.success("Added to wishlist");
  },
};

export async function runIntent(intent: AuthIntent): Promise<void> {
  try {
    await HANDLERS[intent.kind](intent);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "That did not go through. Please try again.");
  }
}

const STORAGE_KEY = "bb-auth-intent";
/** A Google trip that took longer than this was abandoned, not slow. */
export const INTENT_TTL_MS = 10 * 60 * 1000;

function isIntent(value: unknown): value is AuthIntent {
  const candidate = value as Partial<AuthIntent> | null;
  return (
    candidate?.kind === "wishlist.save" &&
    typeof candidate.productId === "string" &&
    candidate.productId.length > 0
  );
}

/** Per-tab by design: the trip returns to the tab that started it (D7). */
export function storeIntent(intent: AuthIntent, now = Date.now()): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ intent, at: now }));
  } catch {
    // Storage blocked: the save is lost, the sign-in still works.
  }
}

export function clearStoredIntent(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored that could be read either.
  }
}

/** Removed before it is returned, so a reload cannot run it twice. */
export function takeStoredIntent(now = Date.now()): AuthIntent | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  clearStoredIntent();

  try {
    const { intent, at } = JSON.parse(raw) as { intent: unknown; at: unknown };
    if (typeof at !== "number" || now - at > INTENT_TTL_MS || now < at) return null;
    return isIntent(intent) ? intent : null;
  } catch {
    return null;
  }
}
