import {
  ACCOUNT_EVENT,
  FACT_KIND,
  MESSAGE_KIND,
  MESSAGE_STATUS,
  PRICING_CATEGORY,
  TEMPLATE_STATE,
  type AccountEvent,
  type MessageKind,
  type PricingCategory,
  type SocialFact,
  type TemplateState,
} from "@server/shared/social-events/facts";
import { SOCIAL_PLATFORM, type SocialPlatform } from "../../social/types";

/**
 * A stored Meta event into our facts (meta-foundation D4; ADR-0084). Pure. Meta's words are mapped
 * to our closed sets here and nowhere else; anything no tool uses yet (read receipts) yields no fact.
 */

export interface StoredEvent {
  key: string;
  connectionId: string;
  product: SocialPlatform;
  field: string;
  occurredAt: Date;
  payload: unknown;
}

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const MAX_REASON = 300;

/** One key per fact: the event's own, then `#n` for the second and later facts of one event. */
const keyOf = (event: StoredEvent, index: number) => (index === 0 ? event.key : `${event.key}#${index}`);

interface Attachment {
  ref: string;
  mimeType: string | null;
  caption: string | null;
  fileName: string | null;
}

interface Body {
  messageKind: MessageKind;
  text: string | null;
  attachments: Attachment[];
  replyTo: string | null;
  buttonPayload: string | null;
  storyRef: string | null;
  productRetailerId: string | null;
  referral: string | null;
  unsupportedLabel: string | null;
}

const body = (messageKind: MessageKind, fields: Partial<Omit<Body, "messageKind">> = {}): Body => ({
  messageKind,
  text: null,
  attachments: [],
  replyTo: null,
  buttonPayload: null,
  storyRef: null,
  productRetailerId: null,
  referral: null,
  unsupportedLabel: null,
  ...fields,
});

const toDate = (seconds: unknown): Date | null => {
  const n = typeof seconds === "string" ? Number(seconds) : num(seconds);
  return n && n > 0 ? new Date(n > 1e12 ? n : n * 1000) : null;
};

// ── WhatsApp ────────────────────────────────────────────────────────────────

const WHATSAPP_MEDIA: Record<string, MessageKind> = {
  image: MESSAGE_KIND.IMAGE,
  video: MESSAGE_KIND.VIDEO,
  audio: MESSAGE_KIND.AUDIO,
  document: MESSAGE_KIND.DOCUMENT,
  sticker: MESSAGE_KIND.STICKER,
};

const WHATSAPP_STATUS: Record<string, (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS]> = {
  sent: MESSAGE_STATUS.SENT,
  delivered: MESSAGE_STATUS.DELIVERED,
  read: MESSAGE_STATUS.READ,
  failed: MESSAGE_STATUS.FAILED,
};

const PRICING: Record<string, PricingCategory> = {
  marketing: PRICING_CATEGORY.MARKETING,
  marketing_lite: PRICING_CATEGORY.MARKETING,
  utility: PRICING_CATEGORY.UTILITY,
  authentication: PRICING_CATEGORY.AUTHENTICATION,
  authentication_international: PRICING_CATEGORY.AUTHENTICATION,
  service: PRICING_CATEGORY.SERVICE,
  referral_conversion: PRICING_CATEGORY.SERVICE,
};

const TEMPLATE_STATES: Record<string, TemplateState> = {
  PENDING: TEMPLATE_STATE.IN_REVIEW,
  IN_APPEAL: TEMPLATE_STATE.IN_REVIEW,
  APPROVED: TEMPLATE_STATE.APPROVED,
  REJECTED: TEMPLATE_STATE.REJECTED,
  PAUSED: TEMPLATE_STATE.PAUSED,
  FLAGGED: TEMPLATE_STATE.PAUSED,
  DISABLED: TEMPLATE_STATE.DISABLED,
  PENDING_DELETION: TEMPLATE_STATE.DISABLED,
  DELETED: TEMPLATE_STATE.DISABLED,
};

/** Which of our account events a Meta field and event name mean. */
function accountEvent(field: string, event: string | null): AccountEvent {
  if (field === "phone_number_quality_update") {
    return event === "UPGRADE" || event === "DOWNGRADE" ? ACCOUNT_EVENT.LIMIT_CHANGED : ACCOUNT_EVENT.QUALITY_CHANGED;
  }
  if (field === "phone_number_name_update") return ACCOUNT_EVENT.NAME_CHANGED;
  if (field === "business_capability_update") return ACCOUNT_EVENT.LIMIT_CHANGED;
  if (event === "PARTNER_REMOVED") return ACCOUNT_EVENT.REMOVED;
  if (event === "ACCOUNT_OFFBOARDED") return ACCOUNT_EVENT.OFFBOARDED;
  return ACCOUNT_EVENT.OTHER;
}

/** What WhatsApp could not hand over, in our words (inbox-core R8). */
const UNSUPPORTED_LABELS: Record<string, string> = {
  unsupported: "A message WhatsApp could not show here",
  unknown: "A message WhatsApp could not show here",
  ephemeral: "A view-once message",
  poll: "A poll",
};

const digits = (value: string | null) => (value && /^\d{6,15}$/.test(value) ? `+${value}` : null);

/** The person on the other side: the sender of a message, the recipient of an echo. */
function whatsappPerson(message: Obj, contacts: unknown, side: "from" | "to") {
  const raw = str(message[side]);
  const scopedId = str(message[`${side}_user_id`]) ?? (side === "from" ? str(message.user_id) : null);
  const contact = arr(contacts)
    .map(obj)
    .find((c) => c && ((raw && c.wa_id === raw) || (scopedId && c.user_id === scopedId)));
  return {
    personKey: scopedId ?? raw ?? "unknown",
    personScopedId: scopedId,
    personName: str(obj(contact?.profile)?.name),
    personHandle: str(obj(contact?.profile)?.username),
    personPhone: digits(raw),
  };
}

function whatsappBody(message: Obj): Body {
  const type = str(message.type) ?? "unknown";
  const context = obj(message.context);
  const referral = obj(message.referral);
  const shared = {
    replyTo: str(context?.id),
    productRetailerId: str(obj(context?.referred_product)?.product_retailer_id),
    referral: str(referral?.source_id) ?? str(referral?.source_url),
  };
  if (type === "text") return body(MESSAGE_KIND.TEXT, { ...shared, text: str(obj(message.text)?.body) });
  const mediaKind = WHATSAPP_MEDIA[type];
  if (mediaKind) {
    const m = obj(message[type]);
    const ref = str(m?.id);
    return body(mediaKind, {
      ...shared,
      text: str(m?.caption),
      attachments: ref ? [{ ref, mimeType: str(m?.mime_type), caption: str(m?.caption), fileName: str(m?.filename) }] : [],
    });
  }
  if (type === "location") {
    const l = obj(message.location);
    return body(MESSAGE_KIND.LOCATION, { ...shared, text: [str(l?.name), str(l?.address)].filter(Boolean).join(", ") || null });
  }
  if (type === "contacts") return body(MESSAGE_KIND.CONTACTS, shared);
  if (type === "interactive") {
    const i = obj(message.interactive);
    const form = obj(i?.nfm_reply);
    if (form) return body(MESSAGE_KIND.FORM_REPLY, { ...shared, text: str(form.body) });
    const reply = obj(i?.button_reply) ?? obj(i?.list_reply);
    return body(MESSAGE_KIND.BUTTON, { ...shared, text: str(reply?.title), buttonPayload: str(reply?.id) });
  }
  if (type === "button") {
    const b = obj(message.button);
    return body(MESSAGE_KIND.BUTTON, { ...shared, text: str(b?.text), buttonPayload: str(b?.payload) });
  }
  return body(MESSAGE_KIND.UNSUPPORTED, { ...shared, unsupportedLabel: UNSUPPORTED_LABELS[type] ?? UNSUPPORTED_LABELS.unsupported });
}

function translateWhatsApp(event: StoredEvent): SocialFact[] {
  const payload = obj(event.payload) ?? {};
  const base = { connectionId: event.connectionId, platform: SOCIAL_PLATFORM.WHATSAPP, occurredAt: event.occurredAt };

  if (event.field === "messages") {
    const message = obj(payload.message);
    if (!message) return [];
    const person = whatsappPerson(message, payload.contacts, "from");
    const messageId = str(message.id) ?? event.key;
    const type = str(message.type);
    if (type === "reaction") {
      const r = obj(message.reaction);
      return [{ kind: FACT_KIND.REACTION, key: event.key, ...base, ...person, messageId: str(r?.message_id) ?? messageId, emoji: str(r?.emoji) }];
    }
    if (type === "order") {
      const order = obj(message.order);
      const items = arr(order?.product_items)
        .map(obj)
        .flatMap((item) => {
          const retailerId = str(item?.product_retailer_id);
          const quantity = Number(item?.quantity);
          return retailerId && Number.isInteger(quantity) && quantity > 0 ? [{ retailerId, quantity }] : [];
        });
      return [{ kind: FACT_KIND.CART_ORDER, key: event.key, ...base, ...person, messageId, catalogueId: str(order?.catalog_id), note: str(order?.text), items }];
    }
    if (type === "system") return [];
    return [{ kind: FACT_KIND.INBOUND_MESSAGE, key: event.key, ...base, ...person, messageId, ...whatsappBody(message) }];
  }

  if (event.field === "messages.status") {
    const status = obj(payload.status);
    const mapped = WHATSAPP_STATUS[str(status?.status) ?? ""];
    if (!status || !mapped) return [];
    const pricing = obj(status.pricing);
    const conversation = obj(status.conversation);
    return [
      {
        kind: FACT_KIND.MESSAGE_STATUS,
        key: event.key,
        ...base,
        messageId: str(status.id) ?? "",
        status: mapped,
        recipientKey: str(status.recipient_user_id) ?? str(status.recipient_id),
        callbackRef: str(status.biz_opaque_callback_data),
        errorCode: num(obj(arr(status.errors)[0])?.code),
        pricingCategory: pricing ? PRICING[str(pricing.category) ?? ""] ?? PRICING_CATEGORY.OTHER : null,
        billable: typeof pricing?.billable === "boolean" ? pricing.billable : null,
        windowClosesAt: toDate(conversation?.expiration_timestamp),
      },
    ];
  }

  if (event.field === "smb_message_echoes") {
    return arr(payload.message_echoes)
      .map(obj)
      .filter((echo): echo is Obj => echo !== null)
      .map((echo, index) => ({
        kind: FACT_KIND.OUTBOUND_ECHO,
        key: keyOf(event, index),
        ...base,
        ...whatsappPerson(echo, payload.contacts, "to"),
        messageId: str(echo.id) ?? keyOf(event, index),
        ...whatsappBody(echo),
      }));
  }

  if (event.field === "smb_app_state_sync") {
    return arr(payload.state_sync)
      .map(obj)
      .filter((sync): sync is Obj => sync !== null && sync.type === "contact")
      .flatMap((sync, index) => {
        const contact = obj(sync.contact);
        const phone = str(contact?.phone_number);
        const action = str(sync.action);
        if (!phone || (action !== "add" && action !== "edit" && action !== "remove")) return [];
        return [
          {
            kind: FACT_KIND.CONTACT_CHANGE,
            key: keyOf(event, index),
            ...base,
            action,
            phone: phone.startsWith("+") ? phone : `+${phone}`,
            name: str(contact?.full_name) ?? str(contact?.first_name),
          },
        ];
      });
  }

  if (event.field === "message_template_status_update") {
    const templateId = payload.message_template_id;
    if (templateId === undefined || templateId === null) return [];
    return [
      {
        kind: FACT_KIND.TEMPLATE_STATUS,
        key: event.key,
        ...base,
        templateId: String(templateId),
        name: str(payload.message_template_name),
        language: str(payload.message_template_language),
        status: TEMPLATE_STATES[str(payload.event) ?? ""] ?? TEMPLATE_STATE.OTHER,
        reason: str(payload.reason)?.slice(0, MAX_REASON) ?? null,
      },
    ];
  }

  if (["account_update", "phone_number_quality_update", "phone_number_name_update", "business_capability_update"].includes(event.field)) {
    const detail = str(payload.current_limit) ?? str(payload.new_quality_score) ?? str(payload.requested_verified_name) ?? null;
    return [{ kind: FACT_KIND.ACCOUNT_UPDATE, key: event.key, ...base, event: accountEvent(event.field, str(payload.event)), detail }];
  }

  return [];
}

// ── Instagram ───────────────────────────────────────────────────────────────

const INSTAGRAM_ATTACHMENTS: Record<string, MessageKind> = {
  image: MESSAGE_KIND.IMAGE,
  video: MESSAGE_KIND.VIDEO,
  audio: MESSAGE_KIND.AUDIO,
  file: MESSAGE_KIND.DOCUMENT,
  share: MESSAGE_KIND.SHARE,
  ig_reel: MESSAGE_KIND.SHARE,
  reel: MESSAGE_KIND.SHARE,
  story_mention: MESSAGE_KIND.STORY_MENTION,
};

const UNSHOWABLE_ON_INSTAGRAM = "A message Instagram could not show here";

const instagramPerson = (personKey: string) => ({ personKey, personScopedId: personKey, personName: null, personHandle: null, personPhone: null });

function instagramBody(message: Obj, referral: string | null): Body {
  const replyTo = obj(message.reply_to);
  const story = obj(replyTo?.story);
  const shared = { text: str(message.text), replyTo: str(replyTo?.mid), buttonPayload: str(obj(message.quick_reply)?.payload), referral };
  if (message.is_unsupported === true) return body(MESSAGE_KIND.UNSUPPORTED, { ...shared, unsupportedLabel: UNSHOWABLE_ON_INSTAGRAM });
  if (story) return body(MESSAGE_KIND.STORY_REPLY, { ...shared, storyRef: str(story.id) ?? str(story.url) });
  const attachments = arr(message.attachments).map(obj).filter((a): a is Obj => a !== null);
  if (attachments.length === 0) return body(MESSAGE_KIND.TEXT, shared);
  const kind = INSTAGRAM_ATTACHMENTS[str(attachments[0].type) ?? ""] ?? MESSAGE_KIND.UNSUPPORTED;
  const files = attachments.flatMap((a) => {
    const url = str(obj(a.payload)?.url);
    return url ? [{ ref: url, mimeType: null, caption: null, fileName: null }] : [];
  });
  return body(kind, {
    ...shared,
    storyRef: kind === MESSAGE_KIND.STORY_MENTION ? files[0]?.ref ?? null : null,
    attachments: files,
    unsupportedLabel: kind === MESSAGE_KIND.UNSUPPORTED ? UNSHOWABLE_ON_INSTAGRAM : null,
  });
}

function translateInstagram(event: StoredEvent): SocialFact[] {
  const payload = obj(event.payload) ?? {};
  const base = { key: event.key, connectionId: event.connectionId, platform: SOCIAL_PLATFORM.INSTAGRAM, occurredAt: event.occurredAt };
  const sender = str(obj(payload.sender)?.id) ?? "unknown";
  const recipient = str(obj(payload.recipient)?.id) ?? "unknown";
  const ref = obj(payload.referral);
  const referral = str(ref?.ref) ?? str(ref?.ad_id);

  switch (event.field) {
    case "messaging.message": {
      const message = obj(payload.message);
      if (!message) return [];
      const echo = message.is_echo === true;
      const person = instagramPerson(echo ? recipient : sender);
      const messageId = str(message.mid) ?? event.key;
      if (message.is_deleted === true) return [{ kind: FACT_KIND.MESSAGE_DELETED, ...base, ...person, messageId }];
      const kind = echo ? FACT_KIND.OUTBOUND_ECHO : FACT_KIND.INBOUND_MESSAGE;
      return [{ kind, ...base, ...person, messageId, ...instagramBody(message, referral) }];
    }
    case "messaging.reaction": {
      const r = obj(payload.reaction);
      if (!r) return [];
      const emoji = r.action === "unreact" ? null : str(r.emoji) ?? str(r.reaction);
      return [{ kind: FACT_KIND.REACTION, ...base, ...instagramPerson(sender), messageId: str(r.mid) ?? "", emoji }];
    }
    case "messaging.edit": {
      const edit = obj(payload.message_edit);
      if (!edit) return [];
      return [{ kind: FACT_KIND.MESSAGE_EDIT, ...base, ...instagramPerson(sender), messageId: str(edit.mid) ?? "", text: str(edit.text) ?? "" }];
    }
    case "messaging.postback": {
      const postback = obj(payload.postback);
      if (!postback) return [];
      return [
        {
          kind: FACT_KIND.INBOUND_MESSAGE,
          ...base,
          ...instagramPerson(sender),
          messageId: str(postback.mid) ?? event.key,
          ...body(MESSAGE_KIND.BUTTON, { text: str(postback.title), buttonPayload: str(postback.payload), referral }),
        },
      ];
    }
    case "comments": {
      const commentId = str(payload.id);
      if (!commentId) return [];
      const from = obj(payload.from);
      const author = str(from?.id) ?? "unknown";
      return [
        {
          kind: FACT_KIND.COMMENT,
          ...base,
          ...instagramPerson(author),
          personHandle: str(from?.username),
          commentId,
          parentId: str(payload.parent_id),
          mediaId: str(obj(payload.media)?.id),
          text: str(payload.text) ?? "",
        },
      ];
    }
    default:
      return [];
  }
}

export function translateEvent(event: StoredEvent): SocialFact[] {
  return event.product === SOCIAL_PLATFORM.WHATSAPP ? translateWhatsApp(event) : translateInstagram(event);
}
