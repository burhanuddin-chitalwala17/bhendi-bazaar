import { prisma } from "@server/shared/prisma";

type DeletionDb = Pick<typeof prisma, "dataDeletionRequest">;

/** The one way to reach `DataDeletionRequest` (Invariant 5). */

export const DELETION_STATE = { PENDING: "PENDING", DONE: "DONE" } as const;
export type DeletionState = (typeof DELETION_STATE)[keyof typeof DELETION_STATE];

export interface DeletionRow {
  id: string;
  code: string;
  product: string;
  sealedUserId: string;
  state: DeletionState;
  requestedAt: Date;
  completedAt: Date | null;
}

export const dataDeletionRepository = {
  async create(db: DeletionDb, data: { code: string; product: string; userIdHash: string; sealedUserId: string }): Promise<DeletionRow> {
    return (await db.dataDeletionRequest.create({ data })) as DeletionRow;
  },

  async byId(id: string): Promise<DeletionRow | null> {
    return (await prisma.dataDeletionRequest.findUnique({ where: { id } })) as DeletionRow | null;
  },

  async byCode(code: string): Promise<Pick<DeletionRow, "state" | "requestedAt" | "completedAt"> | null> {
    return (await prisma.dataDeletionRequest.findUnique({
      where: { code },
      select: { state: true, requestedAt: true, completedAt: true },
    })) as Pick<DeletionRow, "state" | "requestedAt" | "completedAt"> | null;
  },

  /** The sealed id goes with it: once forgotten, nothing here can name the person again (Q7). */
  async markDone(id: string, now: Date): Promise<void> {
    await prisma.dataDeletionRequest.updateMany({
      where: { id, state: DELETION_STATE.PENDING },
      data: { state: DELETION_STATE.DONE, completedAt: now, sealedUserId: "" },
    });
  },
};
