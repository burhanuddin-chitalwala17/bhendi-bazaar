import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";
import {
  isConsentState,
  PLATFORM_SENDER,
  type ConsentChange,
  type ConsentChannel,
  type ConsentHistoryEntryDTO,
  type ConsentSource,
  type ConsentState,
  type Sender,
} from "./consent.types";

/**
 * The one way to reach `ConsentEvent` and `Consent`: one aggregate, since the projection is written
 * only in the transaction that appends its event (consent-core D1).
 */
export const consentRepository = {
  /** Serialises changes to one (contact, sender, channel), so an upload cannot slip past a STOP. */
  async lock(tx: Prisma.TransactionClient, contactId: string, sender: Sender, channel: ConsentChannel): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`consent:${contactId}:${sender}:${channel}`}))`;
  },

  async stateOf(tx: Prisma.TransactionClient, contactId: string, sender: Sender, channel: ConsentChannel): Promise<ConsentState | null> {
    const row = await tx.consent.findUnique({
      where: { contactId_sender_channel: { contactId, sender, channel } },
      select: { state: true },
    });
    return row && isConsentState(row.state) ? row.state : null;
  },

  /** Appends the event and moves the projection to `state`; call under `lock`. */
  async append(
    tx: Prisma.TransactionClient,
    change: {
      contactId: string;
      sender: Sender;
      channel: ConsentChannel;
      change: ConsentChange;
      state: ConsentState;
      source: ConsentSource;
      evidence: Prisma.InputJsonObject;
      at: Date;
    },
  ): Promise<void> {
    const event = await tx.consentEvent.create({
      data: {
        orgId: change.sender === PLATFORM_SENDER ? null : change.sender,
        contactId: change.contactId,
        channel: change.channel,
        change: change.change,
        source: change.source,
        evidence: change.evidence,
        at: change.at,
      },
      select: { id: true },
    });
    const projection = { state: change.state, since: change.at, sourceEventId: event.id };
    await tx.consent.upsert({
      where: { contactId_sender_channel: { contactId: change.contactId, sender: change.sender, channel: change.channel } },
      create: { contactId: change.contactId, sender: change.sender, channel: change.channel, ...projection },
      update: projection,
    });
  },

  /** A shop's own history with a contact, newest first; the platform's never shows to a shop (parent Q27). */
  async historyFor(orgId: string, contactId: string, limit?: number): Promise<ConsentHistoryEntryDTO[]> {
    const rows = await prisma.consentEvent.findMany({
      where: { contactId, orgId },
      orderBy: [{ at: "desc" }, { id: "desc" }],
      take: limit,
      select: { channel: true, change: true, source: true, evidence: true, at: true },
    });
    // The migration's CHECK constraints hold `channel` and `change` to their closed sets.
    return rows as ConsentHistoryEntryDTO[];
  },
};
