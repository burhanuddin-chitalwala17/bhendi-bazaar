import { z } from "zod";

/**
 * What happened on a shop's Instagram or WhatsApp, in our words (ADR-0084 decision 4; social-selling
 * TRD A-D7). Channels translates Meta's payloads into these; inbox, automations and audience read
 * only these. Shared because channels must not import the domains that consume them.
 */

export const FACT_KIND = {
  INBOUND_MESSAGE: "inbound-message",
  OUTBOUND_ECHO: "outbound-echo",
  MESSAGE_STATUS: "message-status",
  REACTION: "reaction",
  MESSAGE_EDIT: "message-edit",
  /** The person unsent a message (Instagram). */
  MESSAGE_DELETED: "message-deleted",
  COMMENT: "comment",
  CART_ORDER: "cart-order",
  CONTACT_CHANGE: "contact-change",
  TEMPLATE_STATUS: "template-status",
  ACCOUNT_UPDATE: "account-update",
  /** Meta gave the person a new business-scoped id (WhatsApp `user_changed_user_id`). */
  PERSON_REKEYED: "person-rekeyed",
} as const;
export type FactKind = (typeof FACT_KIND)[keyof typeof FACT_KIND];

export const MESSAGE_KIND = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENT: "document",
  STICKER: "sticker",
  LOCATION: "location",
  CONTACTS: "contacts",
  BUTTON: "button",
  STORY_REPLY: "story-reply",
  STORY_MENTION: "story-mention",
  SHARE: "share",
  FORM_REPLY: "form-reply",
  UNSUPPORTED: "unsupported",
} as const;
export type MessageKind = (typeof MESSAGE_KIND)[keyof typeof MESSAGE_KIND];

/** What Meta bills a message as, in our words (whatsapp-sending D3). */
export const PRICING_CATEGORY = {
  MARKETING: "marketing",
  UTILITY: "utility",
  AUTHENTICATION: "authentication",
  SERVICE: "service",
  OTHER: "other",
} as const;
export type PricingCategory = (typeof PRICING_CATEGORY)[keyof typeof PRICING_CATEGORY];

/** A template's state as ux.md names it (whatsapp-sending Q7). */
export const TEMPLATE_STATE = {
  IN_REVIEW: "in-review",
  APPROVED: "approved",
  REJECTED: "rejected",
  PAUSED: "paused",
  DISABLED: "disabled",
  OTHER: "other",
} as const;
export type TemplateState = (typeof TEMPLATE_STATE)[keyof typeof TEMPLATE_STATE];

/** What changed about the account, in our words (connect-whatsapp D5). */
export const ACCOUNT_EVENT = {
  REMOVED: "removed",
  OFFBOARDED: "offboarded",
  QUALITY_CHANGED: "quality-changed",
  LIMIT_CHANGED: "limit-changed",
  NAME_CHANGED: "name-changed",
  OTHER: "other",
} as const;
export type AccountEvent = (typeof ACCOUNT_EVENT)[keyof typeof ACCOUNT_EVENT];

export const MESSAGE_STATUS = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
} as const;

const platform = z.enum(["instagram", "whatsapp"]);

/** Every fact names the event it came from (its idempotency key), the connection and when. */
const base = {
  key: z.string(),
  connectionId: z.string(),
  platform,
  occurredAt: z.date(),
};

/**
 * Who wrote. `personKey` is the platform's id for them, scoped to the shop (Instagram-scoped id;
 * WhatsApp business-scoped id, else number); `personScopedId` and `personPhone` are both kept so
 * inbox can join one person's threads in one place when Meta starts sending the scoped id.
 */
const person = {
  personKey: z.string(),
  personScopedId: z.string().nullable(),
  personName: z.string().nullable(),
  personHandle: z.string().nullable(),
  personPhone: z.string().nullable(),
};

/**
 * A file the platform holds. `ref` is opaque to every tool: channels alone fetches it (a WhatsApp
 * media id, an Instagram URL that expires), never a browser.
 */
const media = z.object({ ref: z.string(), mimeType: z.string().nullable(), caption: z.string().nullable(), fileName: z.string().nullable() });

const messageBody = {
  messageId: z.string(),
  messageKind: z.enum(Object.values(MESSAGE_KIND) as [MessageKind, ...MessageKind[]]),
  text: z.string().nullable(),
  attachments: z.array(media),
  /** The message this one answers, by platform id. */
  replyTo: z.string().nullable(),
  /** A button or quick reply the person tapped, as we sent it. */
  buttonPayload: z.string().nullable(),
  /** What the message is about, when the platform says: a story, a catalogue item, a post. */
  storyRef: z.string().nullable(),
  productRetailerId: z.string().nullable(),
  /** The ad or link the person came from (click-to-WhatsApp, Instagram referral), as the platform names it. */
  referral: z.string().nullable(),
  /** What the platform could not show us, named (inbox-core R8). */
  unsupportedLabel: z.string().nullable(),
  /** Where a shared location points, so a thread can open it in Maps (inbox-whatsapp R6). */
  coordinates: z.object({ latitude: z.number(), longitude: z.number() }).nullable(),
};

export const inboundMessage = z.object({ kind: z.literal(FACT_KIND.INBOUND_MESSAGE), ...base, ...person, ...messageBody });
export const outboundEcho = z.object({ kind: z.literal(FACT_KIND.OUTBOUND_ECHO), ...base, ...person, ...messageBody });

export const messageStatus = z.object({
  kind: z.literal(FACT_KIND.MESSAGE_STATUS),
  ...base,
  messageId: z.string(),
  status: z.enum([MESSAGE_STATUS.SENT, MESSAGE_STATUS.DELIVERED, MESSAGE_STATUS.READ, MESSAGE_STATUS.FAILED]),
  /** Who the message went to: their scoped id, else their number. */
  recipientKey: z.string().nullable(),
  /** Our row id, echoed back by WhatsApp from `biz_opaque_callback_data` (ADR-0086). */
  callbackRef: z.string().nullable(),
  errorCode: z.number().nullable(),
  /** What Meta will bill, when it says, and whether it is billable. */
  pricingCategory: z.enum(Object.values(PRICING_CATEGORY) as [PricingCategory, ...PricingCategory[]]).nullable(),
  billable: z.boolean().nullable(),
  /** When the conversation window this message opened or used closes, when Meta says. */
  windowClosesAt: z.date().nullable(),
});

export const reaction = z.object({
  kind: z.literal(FACT_KIND.REACTION),
  ...base,
  ...person,
  messageId: z.string(),
  /** Null when the reaction was removed. */
  emoji: z.string().nullable(),
});

export const messageEdit = z.object({ kind: z.literal(FACT_KIND.MESSAGE_EDIT), ...base, ...person, messageId: z.string(), text: z.string() });
export const messageDeleted = z.object({ kind: z.literal(FACT_KIND.MESSAGE_DELETED), ...base, ...person, messageId: z.string() });

export const comment = z.object({
  kind: z.literal(FACT_KIND.COMMENT),
  ...base,
  ...person,
  commentId: z.string(),
  parentId: z.string().nullable(),
  mediaId: z.string().nullable(),
  text: z.string(),
});

export const cartOrder = z.object({
  kind: z.literal(FACT_KIND.CART_ORDER),
  ...base,
  ...person,
  messageId: z.string(),
  catalogueId: z.string().nullable(),
  note: z.string().nullable(),
  /** Retailer ids and quantities only: a cart's prices are never ours to trust (ADR-0002). */
  items: z.array(z.object({ retailerId: z.string(), quantity: z.number().int().positive() })),
});

export const contactChange = z.object({
  kind: z.literal(FACT_KIND.CONTACT_CHANGE),
  ...base,
  action: z.enum(["add", "edit", "remove"]),
  phone: z.string(),
  name: z.string().nullable(),
});

export const templateStatus = z.object({
  kind: z.literal(FACT_KIND.TEMPLATE_STATUS),
  ...base,
  templateId: z.string(),
  name: z.string().nullable(),
  language: z.string().nullable(),
  status: z.enum(Object.values(TEMPLATE_STATE) as [TemplateState, ...TemplateState[]]),
  /** Meta's reason, cut to 300 characters, for the one place ux.md shows it (a rejection). */
  reason: z.string().nullable(),
});

export const accountUpdate = z.object({
  kind: z.literal(FACT_KIND.ACCOUNT_UPDATE),
  ...base,
  event: z.enum(Object.values(ACCOUNT_EVENT) as [AccountEvent, ...AccountEvent[]]),
  /** The new value where there is one: a quality rating, a messaging limit, a name. */
  detail: z.string().nullable(),
});

/** The person's key changed; their threads follow them (inbox-whatsapp D1, parent Q96). */
export const personRekeyed = z.object({
  kind: z.literal(FACT_KIND.PERSON_REKEYED),
  ...base,
  previousKey: z.string(),
  personKey: z.string(),
});

export const socialFact = z.discriminatedUnion("kind", [
  inboundMessage,
  outboundEcho,
  messageStatus,
  reaction,
  messageEdit,
  messageDeleted,
  comment,
  cartOrder,
  contactChange,
  templateStatus,
  accountUpdate,
  personRekeyed,
]);
export type SocialFact = z.infer<typeof socialFact>;
export type FactOf<K extends FactKind> = Extract<SocialFact, { kind: K }>;
