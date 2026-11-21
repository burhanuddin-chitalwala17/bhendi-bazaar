import { exchangeRateRepository, utcDay, type DayRate } from "@server/content/exchange-rate.repository";

/**
 * The day's US dollar rate in paise (generation-foundation trd D7; ai-images Q13). Fetched the first
 * time a priced picture is asked for on a UTC day, rather than on a timer: a schedule is a query an
 * idle worker pays for every hour, and a day with no paid picture needs no rate. A failed fetch falls
 * back to the latest stored day, which the generation row records; with nothing stored at all, the
 * caller refuses the picture rather than guess.
 */
const SOURCE_URL = "https://api.frankfurter.app/latest?from=USD&to=INR";
const FETCH_TIMEOUT_MS = 5_000;

/** The ECB reference rate as integer paise, or null when the answer is not one. */
export function parseRate(payload: unknown): { paisePerUsd: number; asOf: string } | null {
  const answer = payload as { rates?: { INR?: unknown }; date?: unknown } | null;
  const inr = answer?.rates?.INR;
  if (typeof inr !== "number" || !Number.isFinite(inr) || inr <= 0) return null;
  // The one float in the money path, at the boundary where the rate arrives; integer from here on.
  return { paisePerUsd: Math.round(inr * 100), asOf: typeof answer?.date === "string" ? answer.date : "unknown" };
}

async function fetchToday(now: Date): Promise<DayRate | null> {
  try {
    const answer = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!answer.ok) return null;
    const rate = parseRate(await answer.json());
    if (!rate) return null;
    const day = utcDay(now);
    await exchangeRateRepository.record(day, rate.paisePerUsd, `ECB reference via Frankfurter, ${rate.asOf}`);
    return { day, paisePerUsd: rate.paisePerUsd };
  } catch (error) {
    console.warn("[generation] exchange rate fetch failed; using the latest stored", error);
    return null;
  }
}

/** Today's rate, fetching it if this is the first ask today; else the latest stored; else null. */
export async function rateFor(now: Date = new Date()): Promise<DayRate | null> {
  const stored = await exchangeRateRepository.latestOnOrBefore(now);
  if (stored && stored.day.getTime() === utcDay(now).getTime()) return stored;
  return (await fetchToday(now)) ?? stored;
}
