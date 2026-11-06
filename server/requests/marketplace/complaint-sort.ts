import { CHANNEL_LABELS, isChannel } from "@server/shared/channels";

import type { NeedInput } from "../request.types";
import { issueSubject } from "../kinds/issue.kind";
import { MARKETPLACE_KIND } from "./marketplace.types";

/** One marketplace complaint against one product, as channels hands it over (D5). */
export interface Complaint {
  orgId: string;
  productId: string;
  channel: string;
  theirCategory: string | null;
  issues: Array<{ code: string | null; attribute: string | null; message: string; field: string | null; need: string | null }>;
}

/**
 * Which complaints are ours to fix, as needs (setup-requests D5, marketplace-publish Q24). Pure.
 * A complaint pinned to a listing field, or about the brand or MRP, is the shop's own fix and raises
 * nothing. An attribute this type already answers (a blank fact on the product) is the shop's too. An
 * attribute nobody answers is a fields requirement; anything else with no attribute is an issue.
 */
export function needsFrom(complaints: readonly Complaint[], answered: (channel: string, theirCategory: string) => ReadonlySet<string>): NeedInput[] {
  const out: NeedInput[] = [];
  for (const c of complaints) {
    if (!isChannel(c.channel)) continue;
    const channel = c.channel;
    const unanswered = new Set<string>();
    for (const issue of c.issues) {
      if (issue.field !== null || issue.need !== null) continue;
      if (issue.attribute && c.theirCategory) {
        if (!answered(channel, c.theirCategory).has(issue.attribute)) unanswered.add(issue.attribute);
        continue;
      }
      // No attribute, or no marketplace type to set it up against: only a developer can place it (Q18, Q21).
      const detail = { source: CHANNEL_LABELS[channel], context: c.theirCategory, code: issue.code, subject: issue.attribute, message: issue.message };
      out.push({ orgId: c.orgId, productId: c.productId, subject: issueSubject(detail, ""), detail });
    }
    if (unanswered.size > 0 && c.theirCategory) {
      out.push({
        orgId: c.orgId,
        productId: c.productId,
        subject: { kind: MARKETPLACE_KIND.FIELDS, channel, theirCategory: c.theirCategory, attributes: [...unanswered].sort() },
        detail: null,
      });
    }
  }
  return out;
}
