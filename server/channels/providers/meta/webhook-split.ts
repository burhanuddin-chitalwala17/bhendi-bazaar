import { z } from "zod";
import { sha256Hex } from "@server/shared/hash";
import { SOCIAL_PLATFORM, type SocialPlatform } from "../../social/types";

/**
 * Meta's webhook envelope split into one item per change worth storing, each with the key it is
 * stored once by (ADR-0084; meta-foundation D3). Pure: the payload in, items out.
 */

export interface WebhookItem {
  product: SocialPlatform;
  field: string;
  /**
   * The one id the event is routed by, and which kind it is: a WhatsApp message by its phone number,
   * a WhatsApp account-level change by its business account, an Instagram event by its account.
   */
  route: { kind: RouteKind; id: string };
  /** The account id kept on the row, for the admin view and the drain. */
  externalAccountId: string;
  occurredAt: Date;
  dedupeKey: string;
  payload: unknown;
}

export type RouteKind = "account" | "phone" | "business";

const RECORD = z.record(z.string(), z.unknown());

const WHATSAPP_ENVELOPE = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(z.object({ field: z.string(), value: RECORD })).default([]),
    }),
  ),
});

const INSTAGRAM_ENVELOPE = z.object({
  object: z.literal("instagram"),
  entry: z.array(
    z.object({
      id: z.string(),
      time: z.number().optional(),
      messaging: z.array(RECORD).default([]),
      changes: z.array(z.object({ field: z.string(), value: RECORD })).default([]),
    }),
  ),
});

/** Sorted keys, so the same change always hashes the same. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Every key carries the account it arrived for: the same Meta id can reach two shops (a DM between them). */
function hashKey(product: SocialPlatform, account: string, field: string, value: unknown): string {
  return `${product}:${account}:${field}:h:${sha256Hex(new TextEncoder().encode(canonical(value)))}`;
}

/** Meta sends seconds in some places and milliseconds in others. */
function toDate(value: unknown, fallback: Date): Date {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return new Date(n > 1e12 ? n : n * 1000);
}

const str = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);
const obj = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function splitWhatsApp(body: unknown, now: Date): WebhookItem[] | null {
  const parsed = WHATSAPP_ENVELOPE.safeParse(body);
  if (!parsed.success) return null;
  const items: WebhookItem[] = [];
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const value = change.value;
      const phoneId = str(obj(value.metadata)?.phone_number_id);
      // A change naming a phone belongs to that number's shop alone; only account-level changes route by the account.
      const route = phoneId ? { kind: "phone" as const, id: phoneId } : { kind: "business" as const, id: entry.id };
      const scope = `${entry.id}:${route.id}`;
      const base = { product: SOCIAL_PLATFORM.WHATSAPP, route, externalAccountId: entry.id } as const;
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      if (change.field === "messages" && (messages.length > 0 || statuses.length > 0)) {
        for (const message of messages) {
          const id = str(obj(message)?.id);
          items.push({
            ...base,
            field: "messages",
            occurredAt: toDate(obj(message)?.timestamp, now),
            dedupeKey: id ? `whatsapp:${scope}:msg:${id}` : hashKey(base.product, scope, "messages", message),
            payload: { metadata: value.metadata, contacts: value.contacts, message },
          });
        }
        for (const status of statuses) {
          const id = str(obj(status)?.id);
          const state = str(obj(status)?.status);
          items.push({
            ...base,
            field: "messages.status",
            occurredAt: toDate(obj(status)?.timestamp, now),
            dedupeKey: id && state ? `whatsapp:${scope}:status:${id}:${state}` : hashKey(base.product, scope, "messages.status", status),
            payload: { metadata: value.metadata, status },
          });
        }
        continue;
      }
      items.push({
        ...base,
        field: change.field,
        occurredAt: toDate(value.timestamp, now),
        dedupeKey: hashKey(base.product, scope, change.field, value),
        payload: value,
      });
    }
  }
  return items;
}

function instagramMessagingKey(account: string, event: Record<string, unknown>): { field: string; key: string | null } {
  const sender = str(obj(event.sender)?.id) ?? "";
  const at = String(event.timestamp ?? "");
  const message = obj(event.message);
  if (message) return { field: "messaging.message", key: str(message.mid) && `instagram:${account}:mid:${message.mid}` };
  const reaction = obj(event.reaction);
  if (reaction) {
    // React, unreact, react again with the same emoji are three events: the time tells them apart.
    return {
      field: "messaging.reaction",
      key: str(reaction.mid) && `instagram:${account}:reaction:${reaction.mid}:${sender}:${String(reaction.action)}:${String(reaction.reaction ?? "")}:${at}`,
    };
  }
  const edit = obj(event.message_edit);
  if (edit) return { field: "messaging.edit", key: str(edit.mid) && `instagram:${account}:edit:${edit.mid}:${String(edit.num_edit ?? "")}` };
  const read = obj(event.read);
  if (read) return { field: "messaging.read", key: str(read.mid) && `instagram:${account}:read:${sender}:${read.mid}` };
  if (obj(event.postback)) return { field: "messaging.postback", key: null };
  if (obj(event.referral)) return { field: "messaging.referral", key: null };
  return { field: "messaging.other", key: null };
}

function splitInstagram(body: unknown, now: Date): WebhookItem[] | null {
  const parsed = INSTAGRAM_ENVELOPE.safeParse(body);
  if (!parsed.success) return null;
  const items: WebhookItem[] = [];
  for (const entry of parsed.data.entry) {
    const base = { product: SOCIAL_PLATFORM.INSTAGRAM, route: { kind: "account" as const, id: entry.id }, externalAccountId: entry.id };
    const entryTime = toDate(entry.time, now);
    for (const event of entry.messaging) {
      const { field, key } = instagramMessagingKey(entry.id, event);
      items.push({
        ...base,
        field,
        occurredAt: toDate(event.timestamp, entryTime),
        dedupeKey: key ?? hashKey(base.product, entry.id, field, event),
        payload: event,
      });
    }
    for (const change of entry.changes) {
      const id = str(change.value.id);
      items.push({
        ...base,
        field: change.field,
        occurredAt: toDate(change.value.timestamp ?? change.value.created_time, entryTime),
        dedupeKey: change.field === "comments" && id ? `instagram:${entry.id}:comment:${id}` : hashKey(base.product, entry.id, change.field, change.value),
        payload: change.value,
      });
    }
  }
  return items;
}

/** Items in the envelope, or null when it is not this product's envelope at all. */
export function splitWebhook(product: SocialPlatform, body: unknown, now: Date): WebhookItem[] | null {
  return product === SOCIAL_PLATFORM.WHATSAPP ? splitWhatsApp(body, now) : splitInstagram(body, now);
}
