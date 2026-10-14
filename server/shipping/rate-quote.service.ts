import { createHmac, timingSafeEqual } from "node:crypto";

import { ConflictError } from "@server/shared/domain-error";

/**
 * A shipping rate the server quoted, signed so checkout can charge it without trusting the
 * browser that carried it back (Invariant 1, ADR-0002). Stateless: the alternative, re-quoting
 * the carrier inside the order transaction, holds row locks across an HTTP call and can charge a
 * different price from the one the buyer was shown.
 */

/** Long enough for a buyer to finish checkout; a stale quote is re-fetched, not honoured. */
const QUOTE_TTL_MS = 30 * 60_000;

export interface QuotedRate {
  providerId: string;
  providerName: string;
  courierName: string;
  courierCode?: string;
  /** Paise. */
  rate: number;
  estimatedDays: number;
  mode: string;
  etd?: string;
}

/** What the quote was for. Checkout recomputes these and refuses a quote for anything else. */
export interface QuoteScope {
  fromPincode: string;
  toPincode: string;
  billableWeightKg: number;
}

interface QuotePayload extends QuotedRate, QuoteScope {
  expiresAt: number;
}

function key(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set; shipping quotes cannot be signed");
  // A purpose-bound key, so a quote signature can never stand in for anything auth signs.
  return createHmac("sha256", secret).update("shipping-rate-quote:v1").digest();
}

const sign = (body: string) => createHmac("sha256", key()).update(body).digest("base64url");

export function signRateQuote(rate: QuotedRate, scope: QuoteScope, now = Date.now()): string {
  const payload: QuotePayload = {
    providerId: rate.providerId,
    providerName: rate.providerName,
    courierName: rate.courierName,
    courierCode: rate.courierCode,
    rate: rate.rate,
    estimatedDays: rate.estimatedDays,
    mode: rate.mode,
    etd: rate.etd,
    ...scope,
    expiresAt: now + QUOTE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

const REFUSED = "Shipping options changed while you were checking out. Please review your order and try again.";

/** The rate a quote vouches for, or a refusal if it was altered, has expired, or is for another parcel. */
export function verifyRateQuote(quote: string, scope: QuoteScope, now = Date.now()): QuotedRate {
  const [body, signature, extra] = quote.split(".");
  if (!body || !signature || extra !== undefined) throw new ConflictError(REFUSED);

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new ConflictError(REFUSED);
  }

  // Safe to cast: the signature above proves this server wrote the body.
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as QuotePayload;
  if (
    payload.expiresAt < now ||
    payload.fromPincode !== scope.fromPincode ||
    payload.toPincode !== scope.toPincode ||
    payload.billableWeightKg !== scope.billableWeightKg
  ) {
    throw new ConflictError(REFUSED);
  }

  return {
    providerId: payload.providerId,
    providerName: payload.providerName,
    courierName: payload.courierName,
    courierCode: payload.courierCode,
    rate: payload.rate,
    estimatedDays: payload.estimatedDays,
    mode: payload.mode,
    etd: payload.etd,
  };
}
