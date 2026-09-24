/**
 * A `<Button>` shaped as a row has to be told it is one.
 *
 * `Button`'s default size carries `h-9`, `justify-center` and `whitespace-nowrap` —
 * correct for a button with a word on it, wrong for the row-shaped controls that a
 * conversion sweep turned from raw `<button>` into `<Button>`. Left unstated, a two-line
 * address is clipped to 36px, its contents sit centred, and a long line runs off the
 * edge instead of wrapping. That shipped four times before this test existed: the
 * contact sheet, the profile menu, the saved-address picker and the shipping-method
 * chooser.
 *
 * The classes are read from the Button's **own** opening tag, never from its body: a
 * wrapper's `justify-center` is not answered by an inner `<div className="…
 * justify-between">`, and reading the whole body is how the first version of this test
 * passed a Button whose contents were still centred.
 *
 * Nothing in TypeScript can catch it — the markup is valid and the page renders. So it
 * is checked here, by reading the source the way `design-tokens.test.ts` does.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/components", "src/app"];
/** The primitives themselves set these defaults; they are the definition, not a use. */
const SKIP = "src/components/ui";

function tsxFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (path.startsWith(SKIP)) continue;
    if (statSync(path).isDirectory()) out = out.concat(tsxFiles(path));
    else if (entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/** The `<Button …>` tag itself, stopping at the `>` that closes it — not at one inside
 *  a `className={cn(…)}` expression or a string. */
function openingTag(source: string, start: number): string {
  let quote: string | null = null;
  let braces = 0;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") braces += 1;
    else if (char === "}") braces -= 1;
    else if (char === ">" && braces === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

/** Comments blanked to spaces, newlines kept so reported line numbers stay true.
 *  A `<Button>` named in prose — this file's own header does it — is not a use. */
function withoutComments(source: string): string {
  let out = "";
  let quote: string | null = null;
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (quote) {
      out += char;
      if (char === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (char === quote) quote = null;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      out += char;
      i += 1;
      continue;
    }
    if (char === "/" && (next === "*" || next === "/")) {
      const close = next === "*" ? source.indexOf("*/", i + 2) : source.indexOf("\n", i);
      const stop = close === -1 ? source.length : next === "*" ? close + 2 : close;
      out += source.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
}

/** A `className={OPTION_ROW}` holds its classes in a constant; read that too, or a
 *  row styled through one reads as having no classes at all. */
function classesOf(head: string, source: string): string {
  const ref = head.match(/className=\{([A-Z][A-Z0-9_]*)\}/);
  if (!ref) return head;
  const declared = source.match(
    new RegExp(`\\bconst ${ref[1]}\\s*(?::[^=]+)?=\\s*([\\s\\S]*?);`),
  );
  return declared ? `${head} ${declared[1]}` : head;
}

/** Each `<Button>…</Button>`, matched by depth rather than a fixed window — the long
 *  ones are exactly the ones most likely to be row-shaped. */
function buttons(
  source: string,
): Array<{ line: number; head: string; body: string }> {
  const found: Array<{ line: number; head: string; body: string }> = [];
  for (const match of source.matchAll(/<Button\b/g)) {
    let depth = 0;
    let i = match.index;
    while (i < source.length) {
      if (source.startsWith("<Button", i)) {
        depth += 1;
        i += 7;
      } else if (source.startsWith("</Button>", i)) {
        depth -= 1;
        i += 9;
        if (depth === 0) break;
      } else i += 1;
    }
    found.push({
      line: source.slice(0, match.index).split("\n").length,
      head: openingTag(source, match.index),
      body: source.slice(match.index, i),
    });
  }
  return found;
}

/** Two or more stacked children is a block, not a label. A stack is as often two
 *  `<span className="block">`s — a title over a muted line — as it is two divs, and
 *  counting only divs skipped the contact sheet, one of the rows named above. */
const isRowShaped = (body: string) =>
  (body.match(/<div/g)?.length ?? 0) +
    (body.match(/<p[\s>]/g)?.length ?? 0) +
    (body.match(/className="[^"]*\bblock\b/g)?.length ?? 0) >=
  2;

describe("a Button shaped as a row says so", () => {
  it("the scan reaches the files it claims to check", () => {
    // Every assertion below is "this list of offenders is empty". A scan that finds no files
    // produces an empty list too, and passes — which is how a broken glob becomes a green
    // guard. The floor makes the two outcomes distinguishable.
    expect(ROOTS.flatMap((root) => tsxFiles(root)).length).toBeGreaterThan(100);
  });

  const offenders: string[] = [];

  for (const root of ROOTS) {
    for (const file of tsxFiles(root)) {
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const { line, head, body } of buttons(source)) {
        if (!isRowShaped(body)) continue;
        const classes = classesOf(head, source);
        const missing: string[] = [];
        // `h-9` would clip a block to 36px.
        if (!/\bh-(auto|full|\[)/.test(classes)) missing.push("h-auto");
        // `whitespace-nowrap` would run a long line off the edge rather than wrap it.
        if (!/whitespace-(normal|pre)/.test(classes)) missing.push("whitespace-normal");
        // `justify-center` centres the row's contents instead of starting them at the
        // edge its text is aligned to.
        if (!/justify-(start|between|end)/.test(classes)) missing.push("justify-start");
        if (missing.length) {
          offenders.push(`${file}:${line} needs ${missing.join(" and ")}`);
        }
      }
    }
  }

  it("has no multi-line Button left at the default height", () => {
    expect(offenders).toEqual([]);
  });
});
