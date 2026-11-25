import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";
import { WA_SEND_STATE, type WaSendState } from "./campaigns.types";

type Db = Prisma.TransactionClient | typeof prisma;

const SELECT = {
  id: true,
  orgId: true,
  contactId: true,
  purpose: true,
  sourceRef: true,
  state: true,
  reason: true,
  estimatePaise: true,
} as const;

export type WhatsAppSendRow = Prisma.WhatsAppSendGetPayload<{ select: typeof SELECT }>;

/** What admission decided for a row: its state, why, and what was reserved in which month. */
export interface Admitted {
  state: WaSendState;
  reason: string | null;
  estimatePaise: number;
  spendMonth: string | null;
}

/** The one way to reach `WhatsAppSend` (ADR-0003). */
export const whatsAppSendRepository = {
  async byKey(orgId: string, idempotencyKey: string, db: Db = prisma): Promise<WhatsAppSendRow | null> {
    return db.whatsAppSend.findUnique({ where: { orgId_idempotencyKey: { orgId, idempotencyKey } }, select: SELECT });
  },

  async create(
    tx: Prisma.TransactionClient,
    send: {
      orgId: string;
      contactId: string;
      templateName: string;
      language: string;
      values: Prisma.InputJsonObject;
      purpose: string;
      sourceRef: string;
      idempotencyKey: string;
    } & Admitted,
  ): Promise<WhatsAppSendRow> {
    return tx.whatsAppSend.create({ data: send, select: SELECT });
  },

  /** A shop's held sends, oldest first: Send held releases them in order (D4). */
  async held(orgId: string, take: number, db: Db = prisma): Promise<WhatsAppSendRow[]> {
    return db.whatsAppSend.findMany({
      where: { orgId, state: WA_SEND_STATE.HELD },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
      select: SELECT,
    });
  },

  async countHeld(orgId: string, db: Db = prisma): Promise<number> {
    return db.whatsAppSend.count({ where: { orgId, state: WA_SEND_STATE.HELD } });
  },

  /** Moves a held row on; false when another release took it first. */
  async release(tx: Prisma.TransactionClient, id: string, next: Admitted): Promise<boolean> {
    const { count } = await tx.whatsAppSend.updateMany({ where: { id, state: WA_SEND_STATE.HELD }, data: next });
    return count === 1;
  },
};
