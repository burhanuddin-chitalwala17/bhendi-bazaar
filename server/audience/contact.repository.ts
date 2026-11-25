import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";
import { isConsentState, type ConsentChannel, type ConsentState, type ContactReach, type Sender } from "./consent.types";

type Db = Prisma.TransactionClient | typeof prisma;

/** The one way to reach `Contact` (ADR-0003). Its consents are written by `consent.repository.ts`. */
export const contactRepository = {
  /** `may`'s one indexed read: the contact's reach and its consent for (sender, channel) (D2). */
  async reachWithConsent(
    contactId: string,
    sender: Sender,
    channel: ConsentChannel,
    db: Db = prisma,
  ): Promise<{ contact: ContactReach; state: ConsentState | null } | null> {
    const row = await db.contact.findUnique({
      where: { id: contactId },
      select: {
        orgId: true,
        phoneE164: true,
        bsuid: true,
        email: true,
        consents: { where: { sender, channel }, select: { state: true } },
      },
    });
    if (!row) return null;
    const { consents, ...contact } = row;
    const state = consents[0]?.state;
    return { contact, state: state && isConsentState(state) ? state : null };
  },

  async orgOf(contactId: string, db: Db = prisma): Promise<string | null> {
    const row = await db.contact.findUnique({ where: { id: contactId }, select: { orgId: true } });
    return row?.orgId ?? null;
  },
};
