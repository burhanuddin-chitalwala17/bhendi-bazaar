import { randomBytes } from "node:crypto";
import { sha256Hex } from "@server/shared/hash";

export { OFFER_TOKEN_PATTERN } from "@server/bidding/offer-chain";

/** A fresh link token. Only its hash is stored (winner-offer D9). */
export function mintOfferToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOfferToken(token: string): string {
  return sha256Hex(Buffer.from(token, "utf8"));
}
