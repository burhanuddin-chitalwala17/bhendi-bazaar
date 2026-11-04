import { formatCurrency } from "@/lib/format";
import { waited } from "@/components/org/home/home-copy";
import { ADMIN_ATTENTION, type AdminAttentionItem } from "@server/analytics/attention.types";
import type { IconName } from "@/components/ui/icon";

export interface AttentionCopy {
  title: string;
  detail: string;
  icon: IconName;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What waits, then how long the oldest has (Q31): "3 buyers waiting for refunds · oldest 2 days". */
export function attentionCopy(item: AdminAttentionItem, now: Date): AttentionCopy {
  const oldest = item.oldestAt ? `oldest ${waited(now.getTime() - new Date(item.oldestAt).getTime())}` : null;
  const amount = item.waiting?.amountPaise;
  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

  switch (item.key) {
    case ADMIN_ATTENTION.REFUNDS:
      return {
        icon: "returns",
        title: `${plural(item.waiting?.buyers ?? item.count, "buyer", "buyers")} waiting for refunds`,
        detail: join(plural(item.count, "refund", "refunds"), amount ? `${formatCurrency(amount)} to return` : null, oldest),
      };
    case ADMIN_ATTENTION.PARCELS_TO_BOOK:
      return {
        icon: "parcel",
        title: `${plural(item.count, "parcel", "parcels")} packed and waiting for a pickup`,
        detail: join("Book a courier", oldest),
      };
    case ADMIN_ATTENTION.PAYOUTS:
      return {
        icon: "payout",
        title: `${formatCurrency(amount ?? 0)} owed to ${plural(item.count, "shop", "shops")}`,
        detail: join("Ready to settle", oldest),
      };
    case ADMIN_ATTENTION.COURIER_CONFLICTS:
      return {
        icon: "warning",
        title: `${plural(item.count, "courier update", "courier updates")} we couldn't apply`,
        detail: join("Unknown AWB or a cancelled parcel", oldest),
      };
  }
}
