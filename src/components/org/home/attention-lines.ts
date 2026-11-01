import { CARD_STATE } from "@server/channels/channel-connection.types";
import type { HomeAttentionDto } from "@/data-access-layer/org/home.dal";
import { HOME_COPY, LINE_COPY } from "./home-copy";

export type AttentionLine =
  | { key: string; ok: true; text: string; href: string }
  | { key: string; ok: false; text: string; action: string };

/**
 * "Needs you now", in order (Q5, Q22, Q25): a zero hides its line, a failed read keeps it with its
 * own retry, so one broken source never hides the others or pretends there is nothing to do.
 */
export function attentionLines(orgId: string, a: HomeAttentionDto, now: Date): AttentionLine[] {
  const base = `/org/${orgId}`;
  const failed = (key: string): AttentionLine => ({ key, ok: false, text: HOME_COPY.lineFailed, action: HOME_COPY.tryAgain });
  const lines: AttentionLine[] = [];

  if (!a.parcels.ok) lines.push({ key: "parcels", ok: false, text: HOME_COPY.ordersFailed, action: HOME_COPY.retry });
  else if (a.parcels.value > 0) lines.push({ key: "parcels", ok: true, text: LINE_COPY.parcels(a.parcels.value), href: `${base}/orders` });

  if (!a.reviews.ok) lines.push(failed("reviews"));
  else if (a.reviews.value.count > 0) {
    const { count, productId } = a.reviews.value;
    // All on one product: open it there (Q13); otherwise the Reviews page.
    const href = productId ? `${base}/products/${productId}#reviews` : `${base}/reviews`;
    lines.push({ key: "reviews", ok: true, text: LINE_COPY.reviews(count), href });
  }

  if (!a.channel.ok) lines.push(failed("channel"));
  else if (a.channel.value) {
    const { label, state } = a.channel.value;
    const text = state === CARD_STATE.RENEWAL_DUE ? LINE_COPY.renew(label) : LINE_COPY.reconnect(label);
    lines.push({ key: "channel", ok: true, text, href: `${base}/channels` });
  }

  if (!a.photos.ok) lines.push(failed("photos"));
  else if (a.photos.value > 0) lines.push({ key: "photos", ok: true, text: LINE_COPY.photos(a.photos.value), href: `${base}/library` });

  if (!a.auction.ok) lines.push(failed("auction"));
  else if (a.auction.value) {
    const minutes = Math.ceil((new Date(a.auction.value.endsAt).getTime() - now.getTime()) / 60_000);
    lines.push({ key: "auction", ok: true, text: LINE_COPY.auction(minutes), href: `${base}/bidding` });
  }

  return lines;
}
