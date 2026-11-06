import type { Prisma } from "@prisma/client";

import type { ApplyChoice, NeedInput, PlanBase, PlanUnavailableDTO, RequirementMode, TicketSubject, TicketType } from "../request.types";

/** Read once per resolution pass, shared by every ticket of a kind (D9: one read, not one per ticket). */
export type ResolvedCheck = (subject: TicketSubject) => boolean;

/** A kind's preview could not be computed: its own reason, which its own screen words. */
export class PlanUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`Plan unavailable: ${reason}`);
    this.name = "PlanUnavailableError";
  }
}

/**
 * One kind of ticket (D4): its fingerprint, its words for each side, its plan, its apply and how to
 * tell it is done. The engine never branches on a kind and never knows what a kind is about; a new
 * kind is a file and a registry line.
 */
export interface TicketKindPlugin {
  kind: string;
  type: TicketType;
  /** Requirements only: one tap, or a decision among options (Q6). */
  mode?: RequirementMode;
  /** The fingerprint (D3): everything that makes two needs the same fix, nothing about who needs it. */
  keyOf(subject: TicketSubject): string;
  /** What the shop reads: what it needs, never the steps (Q3). */
  shopTitle(subject: TicketSubject): string;
  /** What the admin reads: the setup (Q3). */
  adminTitle(subject: TicketSubject): string;
  /** What the shop fills once it is ready, if any. */
  names(subject: TicketSubject): string[];
  /** Requirements only: the preview, read live. Throws `PlanUnavailableError` when it cannot be read. */
  plan?(subject: TicketSubject): Promise<PlanBase>;
  /**
   * Requirements only: write the plan the admin chose, inside the caller's transaction. `plan` is null
   * when it could not be read: a kind that can apply a choice by hand does; otherwise it throws.
   */
  apply?(tx: Prisma.TransactionClient, subject: TicketSubject, plan: PlanBase | null, choice: ApplyChoice, now: Date): Promise<void>;
  /** Requirements only: a check over many subjects at once (D9). */
  resolvedCheck?(subjects: readonly TicketSubject[]): Promise<ResolvedCheck>;
}

/**
 * A source of needs: a module that turns what it sees into tickets without the engine knowing it
 * (D5). The marketplace plug-in reads refusals and missing categories; another module adds its own.
 */
export interface NeedSource {
  name: string;
  /** Needs from a batch of events this source understands; unknown payloads answer none. */
  fromEvents?(events: unknown): Promise<NeedInput[]>;
  /** Needs a daily standing check finds (D9); never reopens what an admin resolved. */
  daily?(now: Date): Promise<NeedInput[]>;
}

export type { PlanUnavailableDTO };
