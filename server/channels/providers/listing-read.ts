import type { ReadListing } from "../channel-listing.repository";
import { MarketplaceUnavailableError } from "./marketplace-provider";

/**
 * What a marketplace's listing read reports to as it goes (channel-import D4, D5). The import service
 * owns the sink: it checks the account, writes the rows and records progress.
 */
export interface ListingSink {
  /** Still working, while waiting on the marketplace; keeps the read from looking dead (D3). */
  alive(): Promise<void>;
  /** The marketplace's id for the account, as soon as the read learns it; may throw to stop the read. */
  account(externalAccountId: string): Promise<void>;
  /** A batch of listings and how far the read has got. */
  batch(rows: ReadListing[], progress: { done: number; total: number | null }): Promise<void>;
}

/** A fresh access token, renewed by the domain when it is about to lapse. A read can outlive one. */
export type TokenSource = () => Promise<string>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry only "try later" (429, 5xx, timeouts), backing off; a refused credential is never retried.
 * Not `server/shared/retry.ts`, which retries every error and rewraps the one that stopped it.
 */
export async function retryBusy<T>(call: () => Promise<T>, attempts = 5, baseMs = 2000): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof MarketplaceUnavailableError) || attempt >= attempts) throw error;
      await sleep(Math.min(baseMs * 2 ** (attempt - 1), 30_000));
    }
  }
}

/** Keeps calls at or under a rate: Amazon's Listings API allows five a second per shop. */
export function pacer(perSecond: number) {
  const gap = 1000 / perSecond;
  let next = 0;
  return async () => {
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + gap;
    if (wait > 0) await sleep(wait);
  };
}

/** A marketplace's price, in rupees as a number or a decimal string, as paise (Invariant 3). */
export function paiseFromRupees(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(/,/g, "") : "";
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  // Digits, not floats: "1899.5" is 189950 exactly.
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

export function nonNegativeInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export const sleepFor = sleep;
