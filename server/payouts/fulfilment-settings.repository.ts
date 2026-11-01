import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";

type SettingsDb = Pick<typeof prisma, "fulfilmentSettings">;

const ROW = "default";

/** The FulfilmentSettings table's one repository (Invariant 5, order-fulfilment D14). One row, seeded by its migration. */
export class FulfilmentSettingsRepository {
  async read(db: SettingsDb = prisma) {
    return await db.fulfilmentSettings.findUnique({
      where: { id: ROW },
      select: { cancellationFeePaise: true, version: true, updatedByName: true, updatedAt: true },
    });
  }

  /** Compare-and-set on the version the admin saw: false when another save landed first. */
  async saveFee(
    input: { feePaise: number; seenVersion: number; byName: string | null },
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const saved = await tx.fulfilmentSettings.updateMany({
      where: { id: ROW, version: input.seenVersion },
      data: { cancellationFeePaise: input.feePaise, version: { increment: 1 }, updatedByName: input.byName },
    });
    return saved.count === 1;
  }
}

export const fulfilmentSettingsRepository = new FulfilmentSettingsRepository();
