import { randomBytes } from "crypto";

/**
 * No 0/O, 1/I/L: an org code ends up read aloud and typed from paper, and those
 * pairs are indistinguishable in most fonts.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SUFFIX_LENGTH = 5;

export const ORG_CODE_PATTERN = new RegExp(`^ORG-[${ALPHABET}]{${SUFFIX_LENGTH}}$`);

/**
 * Candidate org codes, for insertion under the unique constraint.
 *
 * Server-generated for the same reason slugs are: an identifier a user invents
 * collides, means nothing to anyone else, and can never be changed once printed.
 * Uniqueness is settled by the constraint with retry, never by a prior existence
 * check — read-then-write is a race the database already arbitrates (ADR-0007's
 * reasoning, applied to inserts). Existing SEL-* codes are untouched.
 */
export function* orgCodeCandidates(): Generator<string> {
  while (true) {
    const bytes = randomBytes(SUFFIX_LENGTH);
    let suffix = "";
    for (let i = 0; i < SUFFIX_LENGTH; i++) {
      suffix += ALPHABET[bytes[i] % ALPHABET.length];
    }
    yield `ORG-${suffix}`;
  }
}
