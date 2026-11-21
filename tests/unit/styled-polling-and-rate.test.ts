/**
 * Two review fixes (2026-11-21): the AI dialog asks after a run every 3 s while it might be done,
 * then every 6 s; and the website prices from the stored exchange rate, fetching only when none exists.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const latestOnOrBefore = vi.fn();
const record = vi.fn();
vi.mock("@server/content/exchange-rate.repository", () => ({
  exchangeRateRepository: { latestOnOrBefore: (...a: unknown[]) => latestOnOrBefore(...a), record: (...a: unknown[]) => record(...a) },
  utcDay: (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
}));
vi.mock("@/components/content/styledShotApiClient", () => ({ styledShotApiClient: {} }));

const { nextPollMs } = await import("@/components/content/useStyledShotRun");
const { storedRateOrFetch } = await import("@server/content/generation/exchange-rate");
const fetchMock = vi.fn();

beforeEach(() => {
  latestOnOrBefore.mockReset();
  record.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("how often the dialog asks", () => {
  it("is every 3 s for the first 15 s, then every 6 s", () => {
    expect(nextPollMs(0)).toBe(3_000);
    expect(nextPollMs(14_999)).toBe(3_000);
    expect(nextPollMs(15_000)).toBe(6_000);
    expect(nextPollMs(120_000)).toBe(6_000);
  });
});

describe("the rate the website prices at", () => {
  it("is the latest stored one, even yesterday's, with no call out", async () => {
    latestOnOrBefore.mockResolvedValue({ day: new Date("2026-11-20"), paisePerUsd: 9_340 });
    await expect(storedRateOrFetch(new Date("2026-11-21T10:00:00Z"))).resolves.toEqual({ day: new Date("2026-11-20"), paisePerUsd: 9_340 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is fetched only when no rate was ever stored", async () => {
    latestOnOrBefore.mockResolvedValue(null);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ date: "2026-11-21", rates: { INR: 93.4 } })));
    await expect(storedRateOrFetch(new Date("2026-11-21T10:00:00Z"))).resolves.toMatchObject({ paisePerUsd: 9_340 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
