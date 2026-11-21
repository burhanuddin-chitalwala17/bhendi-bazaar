import { prisma } from "@server/shared/prisma";

/**
 * The one reader and writer of `ExchangeRate` (ADR-0003; generation-foundation trd D7): one row a
 * day, what a US dollar cost in paise. Never typed into code (ai-images Q13).
 */
export interface DayRate {
  day: Date;
  paisePerUsd: number;
}

/** The UTC calendar day `now` falls in, as the date column stores it. */
export function utcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export class ExchangeRateRepository {
  /** Today's rate, else the most recent one before it; null if none was ever stored. */
  async latestOnOrBefore(now: Date): Promise<DayRate | null> {
    return await prisma.exchangeRate.findFirst({
      where: { day: { lte: utcDay(now) } },
      orderBy: { day: "desc" },
      select: { day: true, paisePerUsd: true },
    });
  }

  /** One row a day: a second fetch the same day replaces the figure, never adds a row. */
  async record(day: Date, paisePerUsd: number, source: string): Promise<void> {
    await prisma.exchangeRate.upsert({
      where: { day },
      create: { day, paisePerUsd, source },
      update: { paisePerUsd, source, fetchedAt: new Date() },
    });
  }
}

export const exchangeRateRepository = new ExchangeRateRepository();
