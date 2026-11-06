import { TICKET_TYPE, type NeedDetail, type TicketSubject } from "../request.types";
import type { TicketKindPlugin } from "./kind";

/** Something no admin action can fix (setup-requests Q21): any module's, keyed by its signature. */
export const ISSUE_KIND = "issue";

/** An issue's subject: the error's signature, as its source said it. */
export interface IssueSubject extends TicketSubject {
  kind: typeof ISSUE_KIND;
  source: string | null;
  context: string | null;
  subjectName: string | null;
  code: string | null;
  message: string | null;
}

const asIssue = (s: TicketSubject) => s as IssueSubject;

/** The subject an error, or a report from scratch, raises (Sentry's grouping: same signature, one issue). */
export function issueSubject(detail: NeedDetail | null, fallbackCode: string): IssueSubject {
  return detail
    ? { kind: ISSUE_KIND, source: detail.source, context: detail.context, subjectName: detail.subject, code: detail.code, message: detail.message }
    : { kind: ISSUE_KIND, source: null, context: null, subjectName: null, code: fallbackCode, message: null };
}

export function issueDetail(s: TicketSubject): NeedDetail | null {
  const i = asIssue(s);
  return i.message === null ? null : { source: i.source, context: i.context, code: i.code, subject: i.subjectName, message: i.message };
}

export const issueKind: TicketKindPlugin = {
  kind: ISSUE_KIND,
  type: TICKET_TYPE.ISSUE,
  keyOf: (s) => {
    const i = asIssue(s);
    return `${ISSUE_KIND}:${[i.source, i.context, i.subjectName, i.code].map((p) => p ?? "-").join(":")}`;
  },
  shopTitle: (s) => (asIssue(s).source ? `A problem with ${asIssue(s).source}` : "A problem you reported"),
  adminTitle: (s) => {
    const i = asIssue(s);
    return [i.source ?? "Reported", i.context, i.subjectName].filter(Boolean).join(" · ");
  },
  names: () => [],
};
