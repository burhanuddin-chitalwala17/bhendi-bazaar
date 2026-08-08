// A field bound with `register()` whose error is never rendered refuses to submit and
// says nothing about why. The compiler cannot see it and the page looks fine, so it has
// shipped twice: the change-password modal bound every field and displayed none, and
// the product form's `sku` had no error output — the one field the whole error-envelope
// work existed to highlight. This walks the source instead of trusting review.
//
// The check is per-file, not per-element: forms display errors either through the
// `error=` prop or as a sibling `{errors.x && …}` block, and both are fine. What is not
// fine is a field whose error is named nowhere in the file that binds it.
//
// A field that genuinely cannot fail belongs in EXEMPT, with the reason.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/components", "src/admin", "src/app"];

const EXEMPT = new Map([
  ["accent", "fixed-option select over the CategoryAccent enum, schema-defaulted; no reachable failure"],
]);

function tsxFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(tsxFiles(path));
    else if (entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/** Does this file put the field's error anywhere a user could read it? */
function displaysError(source: string, field: string): boolean {
  const leaf = field.split(".").pop()!;
  const path = field.split(".").join("\\??\\.");
  return (
    new RegExp(`errors\\??\\.${path}\\b`).test(source) ||
    new RegExp(`getError\\("${leaf}"`).test(source)
  );
}

describe("no field is bound twice", () => {
  // Two inputs registered to one name share a value, so typing in either fills both and
  // the form looks broken without erroring. `defaultAddress` was rendered as a textarea
  // and again as an input in the org form; nothing caught it until someone looked.
  it("registers each field at most once per file", () => {
    const offenders: string[] = [];

    for (const root of ROOTS) {
      for (const file of tsxFiles(root)) {
        const counts = new Map<string, number>();
        for (const [, field] of readFileSync(file, "utf8").matchAll(/register\("([\w.]+)"/g)) {
          counts.set(field, (counts.get(field) ?? 0) + 1);
        }
        for (const [field, n] of counts) {
          if (n > 1) offenders.push(`${file} — ${field} bound ${n}×`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe("every registered field can show its own error", () => {
  it("has no field bound without an error output", () => {
    const offenders: string[] = [];

    for (const root of ROOTS) {
      for (const file of tsxFiles(root)) {
        const source = readFileSync(file, "utf8");
        source.split("\n").forEach((line, index) => {
          const field = line.match(/register\("([a-zA-Z0-9_.]+)"/)?.[1];
          if (!field || EXEMPT.has(field)) return;
          if (!displaysError(source, field)) {
            offenders.push(`${file}:${index + 1} — ${field}`);
          }
        });
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the exemption list honest by requiring a reason for each entry", () => {
    for (const [field, reason] of EXEMPT) {
      expect(reason.length, `${field} needs a reason`).toBeGreaterThan(20);
    }
  });

  it("would catch a field whose error is never named", () => {
    const bound = 'const x = <Input {...register("sku")} />;';
    expect(displaysError(bound, "sku")).toBe(false);
    expect(displaysError(`${bound} error={errors.sku?.message}`, "sku")).toBe(true);
    expect(displaysError(`${bound} {errors.sku && <p/>}`, "sku")).toBe(true);
    expect(displaysError('getError("notes")', "metadata.notes")).toBe(true);
  });
});
