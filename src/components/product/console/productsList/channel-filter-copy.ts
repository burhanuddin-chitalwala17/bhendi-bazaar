import { LISTING_PROBLEM } from "@server/listing/channel-readiness.types";
import type { NotReadyReason } from "@server/listing/channel-readiness.service";

const a = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

/** The products page's channel pills and their filtered view (design-system Q35). */
export const CHANNEL_FILTER = {
  label: "Where it would list",
  allReady: "All ready",
  toFix: (n: number) => `${n} to fix`,
  showing: (n: number, channel: string) => `${n} ${n === 1 ? "product" : "products"} ${channel} would turn down as they stand`,
  clear: (channel: string) => `Stop filtering by ${channel}`,
  whereYouSell: "Where you sell",
  selectAll: (n: number) => `Select all ${n}`,
  clearSelection: "Clear selection",
  /** One product's reason, said on its row. */
  reason: (reason: NotReadyReason, channel: string): string => {
    switch (reason.kind) {
      case LISTING_PROBLEM.NO_CATEGORY:
        return `No ${channel} category`;
      case LISTING_PROBLEM.MISSING_FACT:
        return `Needs ${a(reason.label)} ${reason.label.toLowerCase()}`;
      case LISTING_PROBLEM.UNMAPPED_VALUE:
        return `${reason.label} not matched for ${channel}`;
    }
  },
  more: (n: number) => `+${n}`,
};
