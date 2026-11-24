import { describe, it, expect } from "vitest";
import { checkMessage } from "../../scripts/commit-msg.mjs";

describe("commit-msg", () => {
  it("accepts the project's subjects, old and new", () => {
    for (const s of ["docs: retire the changelog", "Fix: a phone had no way to sign out", "Styled shot: choose the shape (#89)", "Release: AI images (#87)"]) {
      expect(checkMessage(`${s}\n\nbody`, ""), s).toBeNull();
    }
  });

  it("lets git's own subjects through", () => {
    expect(checkMessage("Merge pull request #95 from x/y", "")).toBeNull();
    expect(checkMessage('Revert "docs: x"', "")).toBeNull();
  });

  it("refuses a subject with no area", () => {
    expect(checkMessage("Close every AI picture's credit hold", "")).toMatch(/<area>: <what changed>/);
  });

  it("asks for [MIGRATION] when a migration folder is added, and [CONTRACT] when the contracts change", () => {
    const migration = "A\tprisma/migrations/20261124000000_x/migration.sql";
    expect(checkMessage("checkout: refund late captures", migration)).toMatch(/\[MIGRATION\]/);
    expect(checkMessage("checkout: refund late captures [MIGRATION]", migration)).toBeNull();
    const contract = "M\tserver/cart/cart.types.ts\nM\tdocs/contracts/cart.md";
    expect(checkMessage("cart: rename a field", contract)).toMatch(/\[CONTRACT\]/);
    expect(checkMessage("cart: rename a field [CONTRACT]", contract)).toBeNull();
    expect(checkMessage("docs: reword the cart contract", "M\tdocs/contracts/cart.md"), "a doc edit alone is not a contract change").toBeNull();
  });
});
