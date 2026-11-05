import type { Prisma } from "@prisma/client";

import type { ApplyChoice, RequirementPlanDTO, TicketKind, TicketSubject, TicketType } from "../request.types";

/** Read once per resolution pass, shared by every ticket of a kind (D9: one read, not one per ticket). */
export type ResolvedCheck = (subject: TicketSubject) => boolean;

/**
 * One kind of ticket (D4): its fingerprint, its words for each side, its plan, its apply and how to
 * tell it is done. The engine never branches on a kind; a new kind is a file and a registry line.
 */
export interface TicketKindPlugin {
  kind: TicketKind;
  type: TicketType;
  /** The fingerprint (D3): everything that makes two needs the same fix, nothing about who needs it. */
  keyOf(subject: TicketSubject): string;
  /** What the shop reads: what it needs, never the steps (Q3). */
  shopTitle(subject: TicketSubject): string;
  /** What the admin reads: the setup (Q3). */
  adminTitle(subject: TicketSubject): string;
  /** The names a shop fills once it is ready, if any. */
  names(subject: TicketSubject): string[];
  /** Requirements only: the preview, read live. */
  plan?(subject: TicketSubject, homeOrgId: string | null): Promise<RequirementPlanDTO>;
  /** Requirements only: write the plan the admin chose, inside the caller's transaction. */
  apply?(tx: Prisma.TransactionClient, subject: TicketSubject, plan: RequirementPlanDTO, choice: ApplyChoice, now: Date): Promise<void>;
  /** Requirements only: a check over many subjects at once (D9). */
  resolvedCheck?(subjects: readonly TicketSubject[]): Promise<ResolvedCheck>;
}
