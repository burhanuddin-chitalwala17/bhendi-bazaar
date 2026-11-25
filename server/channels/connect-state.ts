import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { ConnectionChannel } from "./channel-connection.types";

/**
 * The OAuth `state` a connect attempt carries to the marketplace and back (TRD D4): who started
 * it, for which shop and channel, and until when. Signed like the rate quote, so a forged or edited
 * return connects nothing. A replayed one fails at the marketplace, which spends a code once.
 */

const STATE_TTL_MS = 10 * 60_000;

export const CONNECT_PURPOSE = { CONNECT: "connect", RECONNECT: "reconnect" } as const;
export type ConnectPurpose = (typeof CONNECT_PURPOSE)[keyof typeof CONNECT_PURPOSE];

export interface ConnectState {
  orgId: string;
  userId: string;
  channel: ConnectionChannel;
  purpose: ConnectPurpose;
  nonce: string;
  expiresAt: number;
}

export type StateCheck =
  | { ok: true; state: ConnectState }
  /** Signed by us but past its time: the shop is known, so the person can be sent back to it. */
  | { ok: false; reason: "expired"; state: ConnectState }
  | { ok: false; reason: "invalid" };

function key(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set; connect state cannot be signed");
  // Purpose-bound, so this signature can never stand in for anything auth or quotes sign.
  return createHmac("sha256", secret).update("channel-connect-state:v1").digest();
}

export const newStateNonce = () => randomBytes(12).toString("base64url");

const sign = (body: string) => createHmac("sha256", key()).update(body).digest("base64url");

/** A nonce the caller keeps (WhatsApp's sign-up attempt, connect-whatsapp D1) is passed in; otherwise one is made. */
export function signConnectState(
  input: Omit<ConnectState, "nonce" | "expiresAt"> & { nonce?: string },
  now = Date.now(),
  ttlMs = STATE_TTL_MS,
): string {
  const payload: ConnectState = {
    ...input,
    nonce: input.nonce ?? newStateNonce(),
    expiresAt: now + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyConnectState(token: string | null, now = Date.now()): StateCheck {
  if (!token) return { ok: false, reason: "invalid" };
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return { ok: false, reason: "invalid" };

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "invalid" };
  }

  let state: ConnectState;
  try {
    state = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ConnectState;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof state.orgId !== "string" || typeof state.userId !== "string") {
    return { ok: false, reason: "invalid" };
  }
  if (!(state.expiresAt > now)) return { ok: false, reason: "expired", state };
  return { ok: true, state };
}
