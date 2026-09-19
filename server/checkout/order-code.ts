/**
 * The human-facing order reference (ADR-0025).
 *
 * One generator, in one place — there were two, of different shapes, and the live
 * one read the table to add 1 to the highest code it found. That was a read-then-write
 * against a `@unique` column: two checkouts in the same moment minted the same code
 * and one died on a constraint violation.
 */
import crypto from "crypto";

/**
 * No I, L, O, U, 0 or 1: a reference gets read down a phone line and copied off a
 * printed invoice, and dropping U also keeps accidental words out.
 */
export const ORDER_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ORDER_CODE_LENGTH = 8;

/**
 * A fresh order code. Queries nothing, so it cannot race; roughly 6.5 × 10^11
 * possibilities, so it cannot be enumerated and says nothing about how much the
 * store has sold.
 */
export function generateOrderCode(): string {
  // Bytes at or above the largest whole multiple of the alphabet are discarded
  // rather than folded in with `%`, which would make the alphabet's first six
  // characters likelier than the rest.
  const limit = Math.floor(256 / ORDER_CODE_ALPHABET.length) * ORDER_CODE_ALPHABET.length;

  let code = "";
  while (code.length < ORDER_CODE_LENGTH) {
    for (const byte of crypto.randomBytes(ORDER_CODE_LENGTH)) {
      if (byte >= limit) continue;
      code += ORDER_CODE_ALPHABET[byte % ORDER_CODE_ALPHABET.length];
      if (code.length === ORDER_CODE_LENGTH) break;
    }
  }
  return `BB-${code}`;
}
