import { CARD_STATE } from "@server/channels/channel-connection.types";
import { STOCK_ATTENTION } from "@server/channels/channel-stock.types";
import { ATTENTION_CAP } from "@server/analytics/attention.types";
import type { HomeAttentionDto } from "@/data-access-layer/org/home.dal";
import { TEAM_HISTORY_ANCHOR } from "@/components/product/team/team-edit-copy";
import { PROBLEMS } from "@/components/channel/platform-listing-copy";
import { HOME_COPY, LINE_COPY } from "./home-copy";

export type AttentionLine =
  | { key: string; ok: true; text: string; href: string }
  | { key: string; ok: false; text: string; action: string };

/**
 * "Needs you now" (Q5, Q22, Q25; design-system Q31): buyers and money first, at most five. A zero
 * hides its line; a failed read keeps it with its own retry, so one broken source never hides the
 * others or pretends there is nothing to do.
 */
export function attentionLines(orgId: string, a: HomeAttentionDto, now: Date): AttentionLine[] {
  const base = `/org/${orgId}`;
  const failed = (key: string): AttentionLine => ({ key, ok: false, text: HOME_COPY.lineFailed, action: HOME_COPY.tryAgain });
  const lines: AttentionLine[] = [];

  // Buyers who paid and wait on the shop's packing.
  if (!a.toPack.ok) lines.push({ key: "toPack", ok: false, text: HOME_COPY.ordersFailed, action: HOME_COPY.retry });
  else if (a.toPack.value.count > 0) {
    const { count, oldestPaidAt } = a.toPack.value;
    const waitedMs = oldestPaidAt ? now.getTime() - new Date(oldestPaidAt).getTime() : 0;
    lines.push({ key: "toPack", ok: true, text: LINE_COPY.toPack(count, waitedMs), href: `${base}/orders` });
  }

  // Sales stopped on a marketplace.
  if (!a.channel.ok) lines.push(failed("channel"));
  else if (a.channel.value) {
    const { label, state } = a.channel.value;
    const text = state === CARD_STATE.RENEWAL_DUE ? LINE_COPY.renew(label) : LINE_COPY.reconnect(label);
    lines.push({ key: "channel", ok: true, text, href: `${base}/channels` });
  }

  if (!a.stock.ok) lines.push(failed("stock"));
  else if (a.stock.value) {
    const { channel, label, kind, count } = a.stock.value;
    const text = kind === STOCK_ATTENTION.MATCH ? LINE_COPY.matchLocations(label) : LINE_COPY.outOfStock(label, count);
    lines.push({ key: "stock", ok: true, text, href: `${base}/channels/${channel}/listings` });
  }

  // A listing a marketplace stopped or limits, with the reason on its listing (marketplace-publish Q23).
  if (!a.listingProblems.ok) lines.push(failed("listingProblems"));
  else if (a.listingProblems.value) {
    const { channel, label, problems, suppressed } = a.listingProblems.value;
    lines.push({ key: "listingProblems", ok: true, text: PROBLEMS.home(label, problems, suppressed), href: `${base}/channels/${channel}/listings?fix=1` });
  }

  // Sales about to stop: only what sold in the last 30 days (Q31).
  if (!a.lowStock.ok) lines.push(failed("lowStock"));
  else if (a.lowStock.value.count > 0) {
    const { count, soldOut, soonestDays } = a.lowStock.value;
    lines.push({ key: "lowStock", ok: true, text: LINE_COPY.lowStock(count, soldOut, soonestDays), href: `${base}/products?lowStock=true` });
  }

  if (!a.photos.ok) lines.push(failed("photos"));
  else if (a.photos.value > 0) lines.push({ key: "photos", ok: true, text: LINE_COPY.photos(a.photos.value), href: `${base}/library` });

  // Last: the team's fixes are worth a look, never urgent (product-form Q23).
  if (!a.teamEdits.ok) lines.push(failed("teamEdits"));
  else if (a.teamEdits.value.count > 0) {
    const { count, productId } = a.teamEdits.value;
    const href = productId ? `${base}/products/${productId}#${TEAM_HISTORY_ANCHOR}` : `${base}/products`;
    lines.push({ key: "teamEdits", ok: true, text: LINE_COPY.teamEdits(count), href });
  }

  return lines.slice(0, ATTENTION_CAP);
}
