// The reservation plan (Invariant 6, ADR-0007). The decrement itself is a conditional
// write whose race-correctness is database behaviour — untestable here (TESTING.md
// § Database behaviour is currently untestable) and verified by the guard's shape:
// the availability check is the WHERE clause of the write, so there is no interval
// between check and write for a second buyer to slip through. What IS testable is
// the plan: merging and ordering, each of which prevents a distinct failure.
import { describe, expect, it } from "vitest";
import { aggregateReservation } from "@server/checkout/reservation";
import { readFileSync } from "node:fs";

const group = (...items: Array<[string, number]>) => ({
  items: items.map(([productId, quantity]) => ({ productId, quantity })),
});

describe("aggregateReservation", () => {
  it("merges the same product across groups — two decrements of one row inside one transaction would double-check a number the first already changed", () => {
    const plan = aggregateReservation([group(["p1", 2]), group(["p1", 3], ["p2", 1])]);
    expect(plan).toEqual([
      { productId: "p1", quantity: 5 },
      { productId: "p2", quantity: 1 },
    ]);
  });

  it("orders deterministically by product id — two concurrent orders locking rows in different sequence is a deadlock", () => {
    const plan = aggregateReservation([group(["zzz", 1], ["aaa", 1], ["mmm", 1])]);
    expect(plan.map((p) => p.productId)).toEqual(["aaa", "mmm", "zzz"]);
  });

  it("returns an empty plan for no items", () => {
    expect(aggregateReservation([])).toEqual([]);
  });
});

describe("one order-creation path (trd.md D5)", () => {
  it("the legacy racy create is gone from route, service, and repository", () => {
    expect(readFileSync("src/app/api/orders/route.ts", "utf8")).not.toContain(
      "export async function POST"
    );
    expect(readFileSync("server/checkout/order.service.ts", "utf8")).not.toMatch(
      /async createOrder\(/
    );
    expect(readFileSync("server/checkout/order.repository.ts", "utf8")).not.toMatch(
      /async create\(/
    );
  });

  it("the live path holds the guard: decrement conditional on stock, in the transaction", () => {
    const service = readFileSync("server/checkout/order.service.ts", "utf8");
    expect(service).toContain("stock: { gte: quantity }");
    expect(service).toContain("stock: { decrement: quantity }");
    // and the cart leaves in the same transaction (R6)
    expect(service).toContain("tx.cart.deleteMany");
  });
});

describe("the release path cannot beat a confirmation (R4 without breaking R2)", () => {
  it("expiry requires still-pending; confirmation refuses expired — both conditional, so the database picks one winner", () => {
    const repository = readFileSync("server/checkout/order.repository.ts", "utf8");
    expect(repository).toContain('status: "pending_payment", NOT: { paymentStatus: "paid" }');
    expect(repository).toContain('NOT: [{ paymentStatus: "paid" }, { status: "expired" }]');
  });
});
