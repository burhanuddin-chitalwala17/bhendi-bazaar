import { TICKET_KIND, type TicketKind } from "../request.types";
import { amazonCategoryKind } from "./amazon-category.kind";
import { amazonFieldsKind } from "./amazon-fields.kind";
import { issueKind } from "./issue.kind";
import type { TicketKindPlugin } from "./kind";

/** Every kind, once (D4). A new kind is a file and a line here. */
export const KINDS: Readonly<Record<TicketKind, TicketKindPlugin>> = {
  [TICKET_KIND.AMAZON_FIELDS]: amazonFieldsKind,
  [TICKET_KIND.AMAZON_CATEGORY]: amazonCategoryKind,
  [TICKET_KIND.ISSUE]: issueKind,
};

export const kindOf = (kind: string): TicketKindPlugin | null => (KINDS as Record<string, TicketKindPlugin>)[kind] ?? null;

export type { TicketKindPlugin } from "./kind";
