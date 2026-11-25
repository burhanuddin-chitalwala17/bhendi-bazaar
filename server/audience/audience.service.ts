import type { Prisma } from "@prisma/client";

import { NotFoundError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import { answerMay, nextConsent } from "./consent-rules";
import { consentRepository } from "./consent.repository";
import { contactRepository } from "./contact.repository";
import {
  CONSENT_CHANGE,
  PLATFORM_SENDER,
  type ConsentChange,
  type ConsentChangeInput,
  type ConsentChangeResult,
  type ConsentChannel,
  type ConsentHistoryEntryDTO,
  type MayAnswer,
  type Sender,
} from "./consent.types";

const CONTACT_NOT_FOUND = "Contact not found";

async function change(input: ConsentChangeInput, kind: ConsentChange, tx: Prisma.TransactionClient): Promise<ConsentChangeResult> {
  const orgId = await contactRepository.orgOf(input.contactId, tx);
  // A shop records consent only on its own contacts (R1); another shop's id reads as not found.
  if (!orgId || (input.sender !== PLATFORM_SENDER && input.sender !== orgId)) throw new NotFoundError(CONTACT_NOT_FOUND);

  await consentRepository.lock(tx, input.contactId, input.sender, input.channel);
  const current = await consentRepository.stateOf(tx, input.contactId, input.sender, input.channel);
  const next = nextConsent(current, kind, input.source);
  if (!next) return { changed: false, state: current };

  await consentRepository.append(tx, { ...input, change: kind, state: next, at: new Date() });
  return { changed: true, state: next };
}

const inTransaction = <T>(tx: Prisma.TransactionClient | undefined, run: (tx: Prisma.TransactionClient) => Promise<T>) =>
  tx ? run(tx) : prisma.$transaction(run);

/** Consent: who may be sent marketing, by whom, on which channel, and the proof (social-selling/consent-core). */
export const audienceService = {
  /**
   * The question every sender asks before marketing (D2). Pass the send's transaction, so a STOP
   * committed before it is seen.
   */
  async may(sender: Sender, contactId: string, channel: ConsentChannel, tx?: Prisma.TransactionClient): Promise<MayAnswer> {
    const found = await contactRepository.reachWithConsent(contactId, sender, channel, tx);
    return answerMay(found?.contact ?? null, sender, channel, found?.state ?? null);
  },

  /** An opt-in from checkout, the store page, a chat or a first offer. An upload never revives a STOP (R5). */
  async recordOptIn(input: ConsentChangeInput, tx?: Prisma.TransactionClient): Promise<ConsentChangeResult> {
    return inTransaction(tx, (t) => change(input, CONSENT_CHANGE.OPT_IN, t));
  },

  /** A STOP from a chat, a first offer's button or an email link. Takes effect on commit (Q9). */
  async recordStop(input: ConsentChangeInput, tx?: Prisma.TransactionClient): Promise<ConsentChangeResult> {
    return inTransaction(tx, (t) => change(input, CONSENT_CHANGE.STOP, t));
  },

  /** A contact's consent history as its shop reads it, newest first (ux.md: History). */
  async history(orgId: string, contactId: string, limit?: number): Promise<ConsentHistoryEntryDTO[]> {
    if ((await contactRepository.orgOf(contactId)) !== orgId) throw new NotFoundError(CONTACT_NOT_FOUND);
    return consentRepository.historyFor(orgId, contactId, limit);
  },

  /** Whether the contact is this shop's own (R1): a sender writes nothing about another shop's. */
  async isShopContact(orgId: string, contactId: string, tx?: Prisma.TransactionClient): Promise<boolean> {
    return (await contactRepository.orgOf(contactId, tx)) === orgId;
  },
};
