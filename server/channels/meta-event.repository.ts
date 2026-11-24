import { prisma } from "@server/shared/prisma";

/** The one way to reach `MetaEvent` (Invariant 5). Payloads arrive here already sealed. */

export interface NewMetaEvent {
  product: string;
  field: string;
  connectionId: string;
  externalAccountId: string;
  dedupeKey: string;
  occurredAt: Date;
  sealedPayload: string;
}

export const metaEventRepository = {
  /** Writes each event once; a redelivered key is skipped (`ON CONFLICT DO NOTHING`). Answers how many were new. */
  async storeOnce(events: readonly NewMetaEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const { count } = await prisma.metaEvent.createMany({ data: [...events], skipDuplicates: true });
    return count;
  },
};
