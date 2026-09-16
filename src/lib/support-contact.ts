import { SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_MESSAGE } from "@/lib/config";

/**
 * A click-to-chat link for the store's WhatsApp number.
 *
 * `wa.me` is the whole integration (contact-us TRD D1): it opens the app on a phone and
 * WhatsApp Web on a desktop, with no account, token or API dependency. The path takes
 * E.164 digits with no `+` and no spaces — a `+` there is read as part of the number and
 * the link resolves to nothing.
 */
export function whatsappSupportUrl(message: string = SUPPORT_WHATSAPP_MESSAGE): string {
  const text = message.trim();
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${SUPPORT_WHATSAPP.digits}${query}`;
}
