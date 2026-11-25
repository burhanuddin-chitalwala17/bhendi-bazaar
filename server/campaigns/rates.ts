import { MESSAGE_CATEGORY, SEND_PURPOSE, type MessageCategory, type SendPurpose } from "./campaigns.types";

/**
 * What Meta charges per delivered template message in India, in whole paise (whatsapp-sending D3,
 * Q10). Meta bills fractions of a paisa, so each rate is rounded up: an estimate never reserves
 * less than the send will cost. A rate change is a code change, dated here.
 */
export const WHATSAPP_RATES = {
  source: "Meta, WhatsApp Business Platform pricing, India (INR rate card)",
  checkedOn: "2026-11-25",
  paisePerMessage: {
    [MESSAGE_CATEGORY.MARKETING]: 87, // ₹0.8631
    [MESSAGE_CATEGORY.UTILITY]: 12, // ₹0.1150
  } satisfies Record<MessageCategory, number>,
} as const;

/** Until templates carry Meta's category (U3), a send is priced by what its caller says it is. */
export function categoryOf(purpose: SendPurpose): MessageCategory {
  return purpose === SEND_PURPOSE.UTILITY ? MESSAGE_CATEGORY.UTILITY : MESSAGE_CATEGORY.MARKETING;
}

/** The estimate the review shows as "about": rate × count, integers only. */
export function estimatePaise(category: MessageCategory, count = 1): number {
  return WHATSAPP_RATES.paisePerMessage[category] * count;
}
