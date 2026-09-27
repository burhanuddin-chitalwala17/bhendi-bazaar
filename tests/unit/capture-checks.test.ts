// A photo is judged before it is kept (docs/specs/media-library/spec.md R8, trd.md D6). The
// three measures are pure functions of a small grey frame and the source's dimensions, so they
// are pinned on frames a test can draw — a uniform field, a checkerboard — rather than on
// photographs, and the role rule is pinned separately from the arithmetic.
import { describe, expect, it } from "vitest";
import {
  CAPTURE_CHECK,
  CAPTURE_THRESHOLDS,
  FIX_FOR_CHECK,
  checksForRole,
  fixForWarnings,
  judgeCapture,
  laplacianVariance,
  meanLuminance,
  warningsForRole,
  type CaptureCheck,
  type CaptureWarning,
} from "@server/catalog/capture-checks";
import { SHOT_ROLE } from "@server/catalog/shot-list";
import { AVAILABLE_TOOLS, ENHANCEMENT_TOOL } from "@server/content/enhancement.types";

const SIDE = 16;
const BIG = 1600;
const TINY = 600;

const uniform = (value: number, width = SIDE, height = SIDE) =>
  new Uint8ClampedArray(width * height).fill(value);

const checkerboard = (width = SIDE, height = SIDE) =>
  Uint8ClampedArray.from({ length: width * height }, (_, i) =>
    (Math.floor(i / width) + (i % width)) % 2 === 0 ? 0 : 255,
  );

/** A frame with its source in 4:3, `longEdge` wide. */
const frame = (gray: Uint8ClampedArray, longEdge: number, width = SIDE, height = SIDE) => ({
  gray,
  width,
  height,
  sourceWidth: longEdge,
  sourceHeight: Math.round(longEdge * 0.75),
});

const checks = (warnings: CaptureWarning[]) => warnings.map((warning) => warning.check);

describe("meanLuminance", () => {
  it("is the average grey level, whatever the container", () => {
    expect(meanLuminance(uniform(20))).toBe(20);
    expect(meanLuminance([0, 255])).toBe(127.5);
    expect(meanLuminance(checkerboard())).toBe(127.5);
  });

  it("is zero for an empty frame rather than NaN", () => {
    expect(meanLuminance([])).toBe(0);
  });
});

describe("laplacianVariance", () => {
  it("is zero on a uniform field — nothing to focus on", () => {
    expect(laplacianVariance(uniform(128), SIDE, SIDE)).toBe(0);
  });

  it("is large on a checkerboard, whose every interior pixel is an edge", () => {
    expect(laplacianVariance(checkerboard(), SIDE, SIDE)).toBeGreaterThan(CAPTURE_THRESHOLDS.blurLaplacianVariance);
  });

  it("has no interior to read on a frame narrower than the kernel", () => {
    expect(laplacianVariance([0, 255, 0, 255], 2, 2)).toBe(0);
  });
});

describe("judgeCapture", () => {
  it("a uniform dark frame is dark", () => {
    expect(checks(judgeCapture({ ...frame(uniform(20), BIG), role: SHOT_ROLE.PRODUCT }))).toContain(CAPTURE_CHECK.DARK);
  });

  it("a uniform mid-grey frame is not dark but is blurred — zero variance", () => {
    const result = checks(judgeCapture({ ...frame(uniform(128), BIG), role: SHOT_ROLE.PRODUCT }));
    expect(result).not.toContain(CAPTURE_CHECK.DARK);
    expect(result).toEqual([CAPTURE_CHECK.BLUR]);
  });

  it("a checkerboard is not blurred", () => {
    expect(checks(judgeCapture({ ...frame(checkerboard(), BIG), role: SHOT_ROLE.PRODUCT }))).not.toContain(CAPTURE_CHECK.BLUR);
  });

  it("a 600px source is small while a 1600px one is not", () => {
    expect(checks(judgeCapture({ ...frame(checkerboard(), TINY), role: SHOT_ROLE.PRODUCT }))).toEqual([CAPTURE_CHECK.SMALL]);
    expect(checks(judgeCapture({ ...frame(checkerboard(), BIG), role: SHOT_ROLE.PRODUCT }))).toEqual([]);
  });

  it("size is judged on the long edge, whichever way the photo was held", () => {
    const portrait = { gray: checkerboard(), width: SIDE, height: SIDE, sourceWidth: 900, sourceHeight: 1200 };
    expect(checks(judgeCapture({ ...portrait, role: SHOT_ROLE.LABEL }))).toEqual([]);
  });

  it("a lifestyle slot gets the size check only — a dark creative shot is a choice", () => {
    expect(checks(judgeCapture({ ...frame(uniform(20), TINY), role: SHOT_ROLE.LIFESTYLE }))).toEqual([CAPTURE_CHECK.SMALL]);
    expect(checks(judgeCapture({ ...frame(uniform(20), BIG), role: SHOT_ROLE.LIFESTYLE }))).toEqual([]);
  });

  it("a photo with no slot yet gets all three", () => {
    expect(checks(judgeCapture({ ...frame(uniform(20), TINY), role: null }))).toEqual([
      CAPTURE_CHECK.DARK,
      CAPTURE_CHECK.BLUR,
      CAPTURE_CHECK.SMALL,
    ]);
  });

  it("the label slot is judged like a product shot", () => {
    expect(checksForRole(SHOT_ROLE.LABEL)).toEqual(checksForRole(SHOT_ROLE.PRODUCT));
  });

  it("every warning advises; none reads as a refusal", () => {
    for (const { message } of judgeCapture({ ...frame(uniform(20), TINY), role: null })) {
      expect(message).not.toMatch(/\b(cannot|refused|not allowed|blocked)\b/i);
      expect(message.length).toBeGreaterThan(20);
    }
  });
});

describe("warningsForRole", () => {
  const all = judgeCapture({ ...frame(uniform(20), TINY), role: null });

  it("narrows a full judgement to what the slot's role earns", () => {
    expect(checks(warningsForRole(all, SHOT_ROLE.LIFESTYLE))).toEqual([CAPTURE_CHECK.SMALL]);
    expect(checks(warningsForRole(all, SHOT_ROLE.PRODUCT))).toEqual(checks(all));
    expect(checks(warningsForRole(all, null))).toEqual(checks(all));
  });

  it("agrees with judging for that role directly", () => {
    expect(warningsForRole(all, SHOT_ROLE.LIFESTYLE)).toEqual(
      judgeCapture({ ...frame(uniform(20), TINY), role: SHOT_ROLE.LIFESTYLE }),
    );
  });
});

describe("the thresholds are declared once, as numbers", () => {
  it("exports the three the checks compare against", () => {
    for (const key of ["darkMeanLuminance", "blurLaplacianVariance", "minLongEdgePx"] as const) {
      expect(Number.isFinite(CAPTURE_THRESHOLDS[key]), key).toBe(true);
      expect(CAPTURE_THRESHOLDS[key]).toBeGreaterThan(0);
    }
  });

  it("the size message names the threshold rather than a second copy of the number", () => {
    const [small] = judgeCapture({ ...frame(checkerboard(), TINY), role: SHOT_ROLE.PRODUCT });
    expect(small.message).toContain(`${CAPTURE_THRESHOLDS.minLongEdgePx}px`);
  });
});

describe("a warning offers the improvement that answers it", () => {
  it("brightens a dark photo and enlarges a small one, and offers nothing for a blurred one", () => {
    expect(FIX_FOR_CHECK[CAPTURE_CHECK.DARK]).toBe(ENHANCEMENT_TOOL.LIGHT);
    expect(FIX_FOR_CHECK[CAPTURE_CHECK.SMALL]).toBe(ENHANCEMENT_TOOL.ENLARGE);
    // Nothing un-blurs a photograph. Offering a tool anyway would cost the org member a slot to
    // learn that, which is worse than the warning saying only what it knows.
    expect(FIX_FOR_CHECK[CAPTURE_CHECK.BLUR]).toBeNull();
  });

  it("names an answer for every check, and only tools that exist", () => {
    expect(Object.keys(FIX_FOR_CHECK).sort()).toEqual(Object.values(CAPTURE_CHECK).sort());
    for (const fix of Object.values(FIX_FOR_CHECK)) {
      if (fix) expect(AVAILABLE_TOOLS, `${fix} is offered but has no pipeline`).toContain(fix);
    }
  });

  it("takes the first warning that has a fix, and none where nothing does", () => {
    const warning = (check: CaptureCheck): CaptureWarning => ({ check, message: "" });
    expect(fixForWarnings([])).toBeNull();
    expect(fixForWarnings([warning(CAPTURE_CHECK.BLUR)])).toBeNull();
    expect(fixForWarnings([warning(CAPTURE_CHECK.DARK)])).toBe(ENHANCEMENT_TOOL.LIGHT);
    expect(fixForWarnings([warning(CAPTURE_CHECK.BLUR), warning(CAPTURE_CHECK.SMALL)])).toBe(
      ENHANCEMENT_TOOL.ENLARGE,
    );
    expect(fixForWarnings([warning(CAPTURE_CHECK.DARK), warning(CAPTURE_CHECK.SMALL)])).toBe(
      ENHANCEMENT_TOOL.LIGHT,
    );
  });

  it("offers a fix on a real judgement, which is where the banner reads it", () => {
    expect(fixForWarnings(judgeCapture({ ...frame(checkerboard(), TINY), role: SHOT_ROLE.PRODUCT }))).toBe(
      ENHANCEMENT_TOOL.ENLARGE,
    );
    expect(fixForWarnings(judgeCapture({ ...frame(checkerboard(), BIG), role: SHOT_ROLE.PRODUCT }))).toBeNull();
  });
});
