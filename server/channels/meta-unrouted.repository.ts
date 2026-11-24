import { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";

/** The one way to reach `MetaUnroutedCount` (Invariant 5): counts only, never a payload (meta-foundation R2, R5). */

export type UnroutedColumn = "unrouted" | "badSignature" | "previousSecret";

const COLUMNS: Record<UnroutedColumn, Prisma.Sql> = {
  unrouted: Prisma.sql`"unrouted"`,
  badSignature: Prisma.sql`"badSignature"`,
  previousSecret: Prisma.sql`"previousSecret"`,
};

export const metaUnroutedRepository = {
  /** Adds `by` to one day's count in one statement, so concurrent deliveries never lose an increment. */
  async add(day: string, product: string, column: UnroutedColumn, by: number): Promise<void> {
    if (by <= 0) return;
    const col = COLUMNS[column];
    await prisma.$executeRaw`
      INSERT INTO "MetaUnroutedCount" ("day", "product", ${col})
      VALUES (${day}::date, ${product}, ${by})
      ON CONFLICT ("day", "product") DO UPDATE SET ${col} = "MetaUnroutedCount".${col} + EXCLUDED.${col}`;
  },
};
