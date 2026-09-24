/**
 * Stock leaves inventory conditionally, or it does not leave safely (Invariant 6, ADR-0007).
 *
 * The oversell this prevents is a read-then-write: two checkouts each see one unit left, each
 * decides it is available, and both write. The fix is that the *availability check is the where
 * clause of the write* — `quantity: { gte: n }` — so the database decides, once, and the loser
 * gets `count === 0`.
 *
 * This file exists because deleting that condition passed the entire suite. 1233 tests were
 * green with the race reintroduced: the behavioural test in `tests/integration` orders the last
 * unit, which succeeds either way, and nothing looked at the shape of the write. A rule that
 * only a comment enforces is not enforced.
 *
 * Two assertions, because one alone is escapable: the write must carry the condition (a
 * decrement that names no floor is refused, wherever it lives), and `count === 0` must be
 * treated as out-of-stock rather than ignored.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function serverFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".ts")) out.push(p);
    }
  };
  walk(join(ROOT, "server"));
  return out;
}

/** `updateMany({...})` calls on a stock table, as source text, with the file they came from. */
function stockDecrements(): Array<{ file: string; call: string }> {
  const out: Array<{ file: string; call: string }> = [];
  for (const file of serverFiles()) {
    const text = readFileSync(file, "utf8");
    // Braces are counted rather than matched by regex: a nested `data: { quantity: {...} }`
    // ends a lazy match early and the guard then reads half a call.
    for (const match of text.matchAll(/\b(?:tx|prisma)\.(productStock|product)\.updateMany\(/g)) {
      let depth = 0;
      let end = match.index + match[0].length - 1;
      for (let i = end; i < text.length; i += 1) {
        if (text[i] === "(") depth += 1;
        else if (text[i] === ")") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const call = text.slice(match.index, end + 1);
      if (/\bdecrement\b|\bincrement\b/.test(call)) {
        out.push({ file: relative(ROOT, file), call });
      }
    }
  }
  return out;
}

describe("stock moves conditionally, inside the transaction", () => {
  const decrements = stockDecrements();

  it("the scan finds the writes it is here to check", () => {
    // An empty list of offenders and an empty list of writes look the same from outside.
    expect(serverFiles().length).toBeGreaterThan(50);
    expect(
      decrements.length,
      "No guarded stock write was found at all — either the scan broke or the reservation " +
        "moved somewhere this guard cannot see.",
    ).toBeGreaterThan(0);
  });

  it("every decrement names the floor it must clear", () => {
    const offenders = decrements
      .filter(({ call }) => /decrement/.test(call))
      .filter(({ call }) => !/quantity:\s*\{\s*gte:|stock:\s*\{\s*gte:/.test(call))
      .map(({ file }) => file);

    expect(
      offenders,
      "A decrement with no `gte` in its `where` is a read-then-write: two checkouts both see " +
        "the last unit and both take it. Put the availability check in the where clause " +
        "(ADR-0007):\n" + offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });

  it("a decrement that changed no row is treated as out of stock", () => {
    // The condition is worth nothing if nobody reads the answer: `updateMany` does not throw
    // when it matches nothing, it returns `{ count: 0 }` and the order sails on unreserved.
    const offenders = decrements
      .filter(({ call }) => /decrement/.test(call))
      .filter(({ file }) => {
        const text = readFileSync(join(ROOT, file), "utf8");
        return !/\.count\s*===\s*0|\.count\s*<\s*1|!\s*\w+\.count\b/.test(text);
      })
      .map(({ file }) => file);

    expect(
      offenders,
      "`updateMany` reports a miss as `count: 0` rather than throwing, so a guarded write " +
        "nobody checks is an unguarded one:\n" + offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });
});
