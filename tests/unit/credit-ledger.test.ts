/**
 * A shop's credit (ai-images/shop-credits R1–R7; D2–D5): margin rounded up in integers, a charge
 * refused below the worst case, settle and refund that leave the run's lines at exactly cost plus
 * margin, and reversal limited to money that came in. The repository is an in-memory ledger.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withMargin, STARTING_CREDIT_PAISE } from "@server/payouts/credit.types";

interface Line {
  id: string;
  orgId: string;
  kind: string;
  amountPaise: number;
  enhancementId?: string | null;
  runKey?: string | null;
  providerCostPaise?: number | null;
  marginBps?: number | null;
  reversesId?: string | null;
}
const lines: Line[] = [];
let orgMargin: number | null = null;
let platformMargin = 0;

const repo = {
  lockOrg: vi.fn(async () => {}),
  ensureGrants: vi.fn(async (orgIds: string[]) => {
    for (const orgId of orgIds) {
      if (!lines.some((l) => l.kind === "GRANT" && l.orgId === orgId)) {
        lines.push({ id: `grant-${orgId}`, orgId, kind: "GRANT", amountPaise: STARTING_CREDIT_PAISE });
      }
    }
  }),
  balance: vi.fn(async (orgId: string) => lines.filter((l) => l.orgId === orgId).reduce((t, l) => t + l.amountPaise, 0)),
  insert: vi.fn(async (line: Omit<Line, "id">) => {
    const id = `l${lines.length}`;
    lines.push({ ...line, id });
    return { id };
  }),
  insertOnce: vi.fn(async (line: Omit<Line, "id">) => {
    if (lines.some((l) => l.runKey === line.runKey)) return false;
    lines.push({ ...line, id: `l${lines.length}` });
    return true;
  }),
  netForRun: vi.fn(async (enhancementId: string) => {
    const run = lines.filter((l) => l.enhancementId === enhancementId);
    const charge = run.find((l) => l.kind === "CHARGE");
    return {
      orgId: run[0]?.orgId ?? null,
      paise: run.reduce((t, l) => t + l.amountPaise, 0),
      charge: charge ? { providerCostPaise: charge.providerCostPaise ?? null, marginBps: charge.marginBps ?? null } : null,
    };
  }),
  findLine: vi.fn(async (orgId: string, id: string) => {
    const line = lines.find((l) => l.id === id && l.orgId === orgId);
    if (!line) return null;
    const reversedBy = lines.find((l) => l.reversesId === id);
    return { ...line, reversedBy: reversedBy ? { id: reversedBy.id } : null };
  }),
  orgMarginBps: vi.fn(async () => orgMargin),
  platformMarginBps: vi.fn(async () => platformMargin),
};
vi.mock("@server/payouts/credit.repository", () => ({ creditRepository: repo }));
vi.mock("@server/payouts/payment-details.repository", () => ({ paymentDetailsRepository: { read: vi.fn() } }));
vi.mock("@server/shared/audit/audit.service", () => ({ recordAdminActionIn: vi.fn(async () => {}) }));
vi.mock("@server/shared/prisma", () => ({ prisma: { $transaction: async (work: (tx: unknown) => unknown) => work({}) } }));

const { creditService, InsufficientCreditError } = await import("@server/payouts/credit.service");

const tx = {} as never;
const balance = () => repo.balance("org-1");
const runLines = (id: string) => lines.filter((l) => l.enhancementId === id);

beforeEach(() => {
  lines.length = 0;
  orgMargin = null;
  platformMargin = 0;
});

describe("margin (D4, Q15)", () => {
  it("adds nothing at 0%, and rounds a share of a paisa up", () => {
    expect(withMargin(204, 0)).toBe(204);
    // ₹2.04 at 10% is ₹2.244: the shop is charged ₹2.25, never a fraction (spec A3, Invariant 3).
    expect(withMargin(204, 1_000)).toBe(225);
  });

  it("is the shop's own where it has one, else the platform's", async () => {
    platformMargin = 500;
    await expect(creditService.marginFor("org-1")).resolves.toBe(500);
    orgMargin = 0;
    await expect(creditService.marginFor("org-1")).resolves.toBe(0);
  });
});

describe("charging a picture (R5, R7)", () => {
  it("grants the starting credit first, locks the shop, and holds the worst case with margin", async () => {
    const { heldPaise } = await creditService.charge(tx, { orgId: "org-1", enhancementId: "e1", costPaise: 204, worstCostPaise: 374, marginBps: 1_000 });
    expect(heldPaise).toBe(412);
    expect(repo.lockOrg).toHaveBeenCalledWith("org-1", tx);
    await expect(balance()).resolves.toBe(STARTING_CREDIT_PAISE - 412);
    expect(runLines("e1")[0]).toMatchObject({ kind: "CHARGE", providerCostPaise: 374, marginBps: 1_000 });
  });

  it("is refused, with the balance, when it could not cover the most expensive model that might answer", async () => {
    lines.push({ id: "g", orgId: "org-1", kind: "GRANT", amountPaise: 300 });
    const charge = creditService.charge(tx, { orgId: "org-1", enhancementId: "e1", costPaise: 204, worstCostPaise: 374, marginBps: 0 });
    await expect(charge).rejects.toBeInstanceOf(InsufficientCreditError);
    await expect(charge).rejects.toMatchObject({ balancePaise: 300, neededPaise: 374 });
    expect(runLines("e1")).toEqual([]);
  });

  it("never lets two charges together overdraw (review, 2026-11-21)", async () => {
    // ₹1.50, two pictures each costing ₹0.40 but possibly ₹1.00: the second is refused, not allowed through.
    lines.push({ id: "g", orgId: "org-1", kind: "GRANT", amountPaise: 150 });
    await creditService.charge(tx, { orgId: "org-1", enhancementId: "a", costPaise: 40, worstCostPaise: 100, marginBps: 0 });
    await expect(creditService.charge(tx, { orgId: "org-1", enhancementId: "b", costPaise: 40, worstCostPaise: 100, marginBps: 0 })).rejects.toBeInstanceOf(InsufficientCreditError);
    await creditService.settle("a", 100);
    await expect(balance()).resolves.toBe(50);
  });
});

describe("after the run (D5)", () => {
  beforeEach(async () => {
    await creditService.charge(tx, { orgId: "org-1", enhancementId: "e1", costPaise: 13, worstCostPaise: 374, marginBps: 0 });
  });

  it("gives back what was held beyond the price of the model that answered", async () => {
    await creditService.settle("e1", 13);
    expect(runLines("e1").reduce((t, l) => t + l.amountPaise, 0)).toBe(-13);
    await expect(balance()).resolves.toBe(STARTING_CREDIT_PAISE - 13);
  });

  it("settles once, whatever retries", async () => {
    await creditService.settle("e1", 374);
    await creditService.settle("e1", 13);
    expect(runLines("e1").reduce((t, l) => t + l.amountPaise, 0)).toBe(-374);
  });

  it("gives back everything a failed run held, once (Q20)", async () => {
    await creditService.refund("e1");
    await creditService.refund("e1");
    expect(runLines("e1").map((l) => l.kind)).toEqual(["CHARGE", "REFUND"]);
    await expect(balance()).resolves.toBe(STARTING_CREDIT_PAISE);
  });

  it("does not charge a refunded run again when a late settle arrives (review, 2026-11-21)", async () => {
    await creditService.refund("e1");
    await creditService.settle("e1", 13);
    await expect(balance()).resolves.toBe(STARTING_CREDIT_PAISE);
  });

  it("does not refund a settled run when a late refund arrives", async () => {
    await creditService.settle("e1", 13);
    await creditService.refund("e1");
    await expect(balance()).resolves.toBe(STARTING_CREDIT_PAISE - 13);
  });
});

describe("reversing a line (R4)", () => {
  it("adds the opposite line naming the original, which stays", async () => {
    await repo.ensureGrants(["org-1"]);
    await creditService.reverse("org-1", "grant-org-1", "Entered twice", "admin-1");
    expect(lines.map((l) => l.kind)).toEqual(["GRANT", "REVERSAL"]);
    await expect(balance()).resolves.toBe(0);
  });

  it("refuses a second reversal of the same line", async () => {
    await repo.ensureGrants(["org-1"]);
    await creditService.reverse("org-1", "grant-org-1", "Entered twice", "admin-1");
    await expect(creditService.reverse("org-1", "grant-org-1", "Again", "admin-1")).rejects.toThrow("already been reversed");
  });

  it("refuses to reverse a picture's charge, which settles itself", async () => {
    await creditService.charge(tx, { orgId: "org-1", enhancementId: "e1", costPaise: 13, worstCostPaise: 13, marginBps: 0 });
    const charge = runLines("e1")[0];
    await expect(creditService.reverse("org-1", charge?.id ?? "", "No", "admin-1")).rejects.toThrow(/settles itself/);
  });

  it("does not find another shop's line", async () => {
    await repo.ensureGrants(["org-1"]);
    await expect(creditService.reverse("org-2", "grant-org-1", "Entered twice", "admin-1")).rejects.toThrow("Line not found");
  });
});
