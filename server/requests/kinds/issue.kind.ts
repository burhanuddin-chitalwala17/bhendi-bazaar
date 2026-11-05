import { CHANNEL_LABELS } from "@server/shared/channels";

import { TICKET_KIND, TICKET_TYPE, type TicketSubject } from "../request.types";
import type { TicketKindPlugin } from "./kind";

type IssueSubject = Extract<TicketSubject, { kind: typeof TICKET_KIND.ISSUE }>;
const asIssue = (s: TicketSubject) => s as IssueSubject;

/**
 * Something no admin action can fix (setup-requests Q21). From an error, keyed by its signature so the
 * same refusal in many shops is one issue (Sentry's grouping); from scratch, keyed per report.
 */
export const issueKind: TicketKindPlugin = {
  kind: TICKET_KIND.ISSUE,
  type: TICKET_TYPE.ISSUE,
  keyOf: (s) => {
    const i = asIssue(s);
    return `${TICKET_KIND.ISSUE}:${[i.channel, i.theirCategory, i.attribute, i.code].map((p) => p ?? "-").join(":")}`;
  },
  shopTitle: (s) => (asIssue(s).channel ? `A problem with ${CHANNEL_LABELS[asIssue(s).channel!]}` : "A problem you reported"),
  adminTitle: (s) => {
    const i = asIssue(s);
    const where = i.channel ? CHANNEL_LABELS[i.channel] : "Reported";
    return [where, i.theirCategory, i.attribute].filter(Boolean).join(" · ");
  },
  names: () => [],
};
