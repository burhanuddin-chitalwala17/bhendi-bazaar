/**
 * The credit hold against the real database and driver (shop-credits D5). The unit suite mocks the
 * client, which is how a `$queryRaw` on `pg_advisory_xact_lock` — a `void` column the driver adapter
 * cannot read — reached production and failed every Styled shot (2026-11-21). Each case runs inside a
 * transaction it rolls back, so the fixture shop's ledger is left as it was.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

class RolledBack extends Error {}

describe.skipIf(!isDisposableDb)("charging a shop for an AI picture (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let creditService: typeof import("@server/payouts/credit.service").creditService;
  let orgId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ creditService } = await import("@server/payouts/credit.service"));
    ({ orgId } = await ensureFixtures());
  });

  /** Runs `body` in a transaction and always rolls it back, returning what it produced. */
  async function inRolledBack<T>(body: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>): Promise<T> {
    let result: T | undefined;
    await prisma
      .$transaction(async (tx) => {
        result = await body(tx);
        throw new RolledBack();
      })
      .catch((error: unknown) => {
        if (!(error instanceof RolledBack)) throw error;
      });
    return result as T;
  }

  it("takes the shop's lock and holds the worst case, with the starting grant in place", async () => {
    const enhancementId = `credit-it-${Date.now().toString(36)}`;
    const result = await inRolledBack((tx) =>
      creditService.charge(tx, { orgId, enhancementId, costPaise: 1_263, worstCostPaise: 1_300, marginBps: 0 }),
    );
    expect(result.heldPaise).toBe(1_300);
    expect(result.balancePaise).toBeGreaterThanOrEqual(0);
  });

  it("charges the same run once, however often it is asked", async () => {
    const enhancementId = `credit-it-twice-${Date.now().toString(36)}`;
    const input = { orgId, enhancementId, costPaise: 500, worstCostPaise: 500, marginBps: 0 };
    const [first, second] = await inRolledBack(async (tx) => [
      await creditService.charge(tx, input),
      await creditService.charge(tx, input),
    ]);
    expect(second.balancePaise).toBe(first.balancePaise);
  });
});
