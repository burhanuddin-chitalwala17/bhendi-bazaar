import { encryptSecret } from "@server/shared/crypto";
import type { SocialPlatform } from "./social/types";
import { channelConnectionRepository } from "./channel-connection.repository";
import { metaEventRepository, type NewMetaEvent } from "./meta-event.repository";
import { metaUnroutedRepository } from "./meta-unrouted.repository";
import type { IntakeResult } from "./meta-event.types";
import { sameToken, verifyMetaSignature } from "./providers/meta/signature";
import { signingSecrets, webhookVerifyToken } from "./providers/meta/settings";
import { splitWebhook, type RouteKind } from "./providers/meta/webhook-split";

/**
 * Meta's webhooks: verify, store each change once, answer (ADR-0078; meta-foundation D3).
 * Nothing here acts on an event; the drain does, after the answer.
 */

/** Meta's own cap on a delivery's body. */
export const META_MAX_BODY_BYTES = 3 * 1024 * 1024;

export type IntakeOutcome =
  | { kind: "accepted"; result: IntakeResult }
  | { kind: "refused"; reason: "signature" | "too-large" };

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

function log(product: SocialPlatform, fields: Record<string, unknown>) {
  console.info(JSON.stringify({ scope: "meta.intake", product, ...fields }));
}

/**
 * Forged deliveries are counted in memory and written at most once a minute per process, so a
 * flood of them costs no database write each (the routes are rate-limit exempt).
 */
const FORGED_FLUSH_MS = 60_000;
const forged = new Map<string, number>();
let forgedFlushedAt = 0;

async function countForged(day: string, product: SocialPlatform, now: Date): Promise<void> {
  const key = `${day}|${product}`;
  forged.set(key, (forged.get(key) ?? 0) + 1);
  if (now.getTime() - forgedFlushedAt < FORGED_FLUSH_MS) return;
  forgedFlushedAt = now.getTime();
  const pending = [...forged.entries()];
  forged.clear();
  for (const [entry, count] of pending) {
    const [pendingDay, pendingProduct] = entry.split("|");
    await metaUnroutedRepository.add(pendingDay, pendingProduct, "badSignature", count);
  }
}

/** For tests: forget what is held in memory. */
export function resetForgedCounts(): void {
  forged.clear();
  forgedFlushedAt = 0;
}

/** Each id to the one live connection holding it; an id two connections hold routes nowhere. */
function routeTable(
  connections: Array<{ id: string; externalAccountId: string | null; externalPhoneId: string | null; externalBusinessId: string | null }>,
): (kind: RouteKind, id: string) => string | null {
  const tables: Record<RouteKind, Map<string, string | null>> = { account: new Map(), phone: new Map(), business: new Map() };
  const put = (kind: RouteKind, id: string | null, connectionId: string) => {
    if (!id) return;
    const held = tables[kind].get(id);
    tables[kind].set(id, held === undefined || held === connectionId ? connectionId : null);
  };
  for (const connection of connections) {
    put("account", connection.externalAccountId, connection.id);
    put("phone", connection.externalPhoneId, connection.id);
    put("business", connection.externalBusinessId, connection.id);
  }
  return (kind, id) => tables[kind].get(id) ?? null;
}

export const metaIntakeService = {
  /** Meta's subscription handshake: echo the challenge only for our verify token. */
  verifySubscription(mode: string | null, token: string | null, challenge: string | null): string | null {
    if (mode !== "subscribe" || !challenge) return null;
    return sameToken(token, webhookVerifyToken()) ? challenge : null;
  },

  async receive(product: SocialPlatform, body: Uint8Array, signature: string | null, now = new Date()): Promise<IntakeOutcome> {
    const day = utcDay(now);
    if (body.byteLength > META_MAX_BODY_BYTES) return { kind: "refused", reason: "too-large" };

    const check = verifyMetaSignature(body, signature, signingSecrets(product));
    if (!check.valid) {
      await countForged(day, product, now);
      log(product, { outcome: "bad-signature" });
      return { kind: "refused", reason: "signature" };
    }
    if (check.previousSecret) await metaUnroutedRepository.add(day, product, "previousSecret", 1);

    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(body));
    } catch {
      parsed = undefined;
    }
    const items = splitWebhook(product, parsed, now);
    if (items === null) {
      // Signed by Meta but not an envelope we know: counted, never retried into a disabled webhook.
      await metaUnroutedRepository.add(day, product, "unrouted", 1);
      log(product, { outcome: "unknown-envelope" });
      return { kind: "accepted", result: { stored: 0, duplicates: 0, unrouted: 1 } };
    }

    const routeIds = [...new Set(items.map((item) => item.route.id))];
    const route = routeTable(await channelConnectionRepository.socialRoutes(product, routeIds));

    const rows: NewMetaEvent[] = [];
    let unrouted = 0;
    for (const item of items) {
      const connectionId = route(item.route.kind, item.route.id);
      if (!connectionId) {
        unrouted += 1;
        continue;
      }
      rows.push({
        product,
        field: item.field,
        connectionId,
        externalAccountId: item.externalAccountId,
        dedupeKey: item.dedupeKey,
        occurredAt: item.occurredAt,
        sealedPayload: encryptSecret(JSON.stringify(item.payload)),
      });
    }

    const stored = await metaEventRepository.storeOnce(rows);
    await metaUnroutedRepository.add(day, product, "unrouted", unrouted);
    const result = { stored, duplicates: rows.length - stored, unrouted };
    log(product, { outcome: "accepted", ...result });
    return { kind: "accepted", result };
  },
};
