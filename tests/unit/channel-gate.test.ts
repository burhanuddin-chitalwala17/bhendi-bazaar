/**
 * What a channel asks of a photograph, and where that question may be asked
 * (image-enhancement spec R6, trd D7).
 *
 * Two halves. The first pins the rules themselves: the store accepts anything, every other
 * channel's number is compared the same way, and the verdict names the one tool that answers it.
 *
 * The second is a source scan, and it is the half that matters. A size rule is the kind of thing
 * that starts at the moment of use and migrates inwards — first a warning on save, then a
 * refusal — until a shop with a 900px photograph of a real thing cannot list it at all. That is
 * the failure spec R6 exists to prevent, and no type catches an import. So the areas the rule may
 * never reach are declared below with the reason each one is out, the way
 * `tests/unit/overlay-surfaces.test.ts` declares who may reach for a sheet.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ENHANCEMENT_TOOL } from "@server/content/enhancement.types";
import {
  ASPECT_TOLERANCE,
  CHANNEL,
  CHANNEL_IMAGE_PROBLEM,
  CHANNEL_IMAGE_RULES,
  ENLARGE_TARGET_LONG_EDGE,
  imageMeetsChannel,
} from "@server/content/channel-rules";

const ROOT = resolve(__dirname, "../..");
/** The symbol the scan follows. Named once, so renaming it in source renames it here too. */
const GATE = imageMeetsChannel.name;

describe("the rules are declared once, and every channel has an answer", () => {
  it("gives every channel a rule or says it has none, so a new one cannot be forgotten", () => {
    expect(Object.keys(CHANNEL_IMAGE_RULES).sort()).toEqual(Object.values(CHANNEL).sort());
    // Null is a stated answer, not a gap: it is what "the store accepts what the shop has" means.
    expect(CHANNEL_IMAGE_RULES[CHANNEL.STORE]).toBeNull();
    for (const channel of [CHANNEL.AMAZON, CHANNEL.FLIPKART, CHANNEL.META]) {
      expect(CHANNEL_IMAGE_RULES[channel], channel).not.toBeNull();
    }
  });

  it("states each marketplace's published minimum", () => {
    expect(CHANNEL_IMAGE_RULES[CHANNEL.AMAZON]?.minLongEdgePx).toBe(1000);
    expect(CHANNEL_IMAGE_RULES[CHANNEL.AMAZON]?.bestLongEdgePx, "1600px is what turns zoom on").toBe(1600);
    expect(CHANNEL_IMAGE_RULES[CHANNEL.FLIPKART]?.minLongEdgePx).toBe(1000);
    expect(CHANNEL_IMAGE_RULES[CHANNEL.META]?.minLongEdgePx).toBe(1080);
    expect(CHANNEL_IMAGE_RULES[CHANNEL.META]?.aspect, "a feed post is square").toBe(1);
  });

  it("aims one enlarge at the largest edge any channel asks for, derived rather than typed", () => {
    const asked = Object.values(CHANNEL_IMAGE_RULES)
      .filter((rule) => rule !== null)
      .map((rule) => rule.bestLongEdgePx ?? rule.minLongEdgePx);
    expect(ENLARGE_TARGET_LONG_EDGE).toBe(Math.max(...asked));
    // Spec A4: an 800px photo enlarged is a 1600px photo that Amazon takes, zoom and all.
    expect(ENLARGE_TARGET_LONG_EDGE).toBe(1600);
  });
});

describe("imageMeetsChannel", () => {
  it("passes the store whatever it is handed", () => {
    for (const image of [{ width: 200, height: 150 }, { width: 4000, height: 3000 }, { width: 1, height: 1 }]) {
      expect(imageMeetsChannel(image, CHANNEL.STORE)).toEqual({ ok: true, missing: [], fix: null });
    }
  });

  it("refuses a 900px photograph for Amazon and Flipkart, and names the tool that fixes it", () => {
    for (const channel of [CHANNEL.AMAZON, CHANNEL.FLIPKART]) {
      const verdict = imageMeetsChannel({ width: 900, height: 675 }, channel);
      expect(verdict.ok, channel).toBe(false);
      expect(verdict.missing).toEqual([CHANNEL_IMAGE_PROBLEM.TOO_SMALL]);
      expect(verdict.fix).toBe(ENHANCEMENT_TOOL.ENLARGE);
    }
  });

  it("passes a 1200px photograph to both, whatever shape it is", () => {
    for (const channel of [CHANNEL.AMAZON, CHANNEL.FLIPKART]) {
      expect(imageMeetsChannel({ width: 1200, height: 900 }, channel).ok, channel).toBe(true);
      expect(imageMeetsChannel({ width: 900, height: 1200 }, channel).ok, `${channel} portrait`).toBe(true);
    }
  });

  it("measures the long side, not the width", () => {
    expect(imageMeetsChannel({ width: 800, height: 1400 }, CHANNEL.AMAZON).ok).toBe(true);
  });

  it("names white for Meta's shape, because a square of white meets it without cropping", () => {
    const verdict = imageMeetsChannel({ width: 1440, height: 1080 }, CHANNEL.META);
    expect(verdict.ok).toBe(false);
    expect(verdict.missing).toEqual([CHANNEL_IMAGE_PROBLEM.WRONG_ASPECT]);
    expect(verdict.fix).toBe(ENHANCEMENT_TOOL.WHITE);

    expect(imageMeetsChannel({ width: 1080, height: 1080 }, CHANNEL.META).ok).toBe(true);
    // Whole pixels never divide into an exact square; a hundredth of nothing is not the wrong shape.
    expect(imageMeetsChannel({ width: 1081, height: 1080 }, CHANNEL.META).ok).toBe(true);
    expect(ASPECT_TOLERANCE).toBeGreaterThan(0);
  });

  it("answers size before shape, since padding a small photograph leaves it small", () => {
    const verdict = imageMeetsChannel({ width: 800, height: 600 }, CHANNEL.META);
    expect(verdict.missing).toEqual([CHANNEL_IMAGE_PROBLEM.TOO_SMALL, CHANNEL_IMAGE_PROBLEM.WRONG_ASPECT]);
    expect(verdict.fix, "one tool at a time (spec R1), and the size is the hard floor").toBe(
      ENHANCEMENT_TOOL.ENLARGE,
    );
  });
});

// ── The store never blocks ────────────────────────────────────────────────────

/**
 * Where the channel rule may never be asked, and what would break if it were. Each entry is a
 * path prefix, relative to the repository root.
 */
const NEVER_ASKS: Record<string, string> = {
  "server/catalog/product":
    "The product write path. A photograph below a marketplace's minimum is still a photograph of " +
    "a real thing for sale, and saving it must stay unconditional (spec R6).",
  "src/data-access-layer/":
    "Every server-component read. A channel rule here would decide what a buyer is shown on the " +
    "strength of what Amazon happens to ask for this year.",
  "src/app/(main)/": "The storefront. It shows what the shop has, at the size the shop has it.",
  "src/app/(store)/": "An org's own storefront, which is the same projection on one domain (ADR-0030).",
};

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== "node_modules") walk(path);
      } else if (/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path)) {
        out.push(relative(ROOT, path));
      }
    }
  };
  ["src", "server"].forEach((dir) => walk(join(ROOT, dir)));
  return out;
}

const FILES = sourceFiles().map((path) => ({ path, code: readFileSync(join(ROOT, path), "utf8") }));

describe("the store never blocks on a channel's rule", () => {
  it("the scan reaches the tree and the symbol it claims to follow", () => {
    // An empty scan produces an empty offender list and reads green. Both ends are pinned:
    // the files exist, and the rule is still called what this file thinks it is called.
    expect(FILES.length).toBeGreaterThan(300);
    expect(FILES.some((file) => file.path === "server/content/channel-rules.ts" && file.code.includes(GATE))).toBe(true);
  });

  it("every declared area still exists, so a rename cannot quietly empty the gate", () => {
    const empty = Object.keys(NEVER_ASKS).filter((prefix) => !FILES.some((file) => file.path.startsWith(prefix)));
    expect(
      empty,
      "These areas match no file. Either the tree moved and the prefix must follow, or the entry " +
        "is stale — an area nobody can violate is not a guard:\n" + empty.map((p) => `    ${p}`).join("\n"),
    ).toEqual([]);
  });

  it(`nothing in the storefront, the product write path or the DAL asks ${GATE}`, () => {
    const offenders = FILES.filter((file) => file.code.includes(GATE)).flatMap((file) => {
      const prefix = Object.keys(NEVER_ASKS).find((candidate) => file.path.startsWith(candidate));
      return prefix ? [`${file.path} — ${NEVER_ASKS[prefix]}`] : [];
    });

    expect(
      offenders,
      `${GATE} is the time-of-use gate and nothing else (spec R6, trd D7). It belongs where an ` +
        "image is put to a channel, and to the editor's advisory copy. Asking it here turns a " +
        "marketplace's number into a rule for the shop's own store:\n" +
        offenders.map((o) => `    ${o}`).join("\n"),
    ).toEqual([]);
  });
});
