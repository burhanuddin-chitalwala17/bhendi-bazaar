import { ENHANCEMENT_TOOL, type EnhancementTool } from "@server/content/enhancement.types";

/**
 * What each channel asks of a photograph, declared once (image-enhancement spec R6, trd D7).
 *
 * This is the time-of-use gate and nothing else. It is read where an image is *put* to a
 * marketplace or a post, never where a product is saved: the store accepts what the shop has, so
 * a photograph too small for Amazon is still a perfectly good photograph of a thing for sale.
 * `tests/unit/channel-gate.test.ts` holds that line by scanning for the import.
 *
 * The numbers are each channel's published requirement, with its source on the line. They are
 * here rather than at a call site because a marketplace changing its mind is one edit, and
 * because a number typed twice is a number that disagrees with itself.
 */

import { CHANNEL, CHANNELS, isChannel, type Channel } from "@server/shared/channels";

// Re-exported, not re-declared: every caller that already imported the set from this module
// keeps working, and there is still exactly one place the members are written down.
export { CHANNEL, CHANNELS, isChannel, type Channel };

/** What a channel found wanting in an image. A closed set, so the copy for each is written once. */
export const CHANNEL_IMAGE_PROBLEM = { TOO_SMALL: "too-small", WRONG_ASPECT: "wrong-aspect" } as const;
export type ChannelImageProblem = (typeof CHANNEL_IMAGE_PROBLEM)[keyof typeof CHANNEL_IMAGE_PROBLEM];

export interface ChannelImageRule {
  /** Below this on the long side the channel refuses the image outright. */
  minLongEdgePx: number;
  /** What the channel rewards rather than requires, or null where it asks for nothing more. */
  bestLongEdgePx: number | null;
  /** Width ÷ height the channel insists on, or null where it takes the picture's own shape. */
  aspect: number | null;
}

/**
 * A rule per channel, or `null` for one that has none. Null is stated rather than left out: a
 * channel missing from this table would read as "not decided yet", and the store's answer is
 * decided — it is the whole of spec R6.
 */
export const CHANNEL_IMAGE_RULES: Record<Channel, ChannelImageRule | null> = {
  // Our own storefront. It shows what the shop photographed, at whatever size the shop had, and
  // is the one surface an org member can always reach without buying a better camera first.
  [CHANNEL.STORE]: null,
  // Amazon: a main image must be at least 1000px on its longest side, and 1600px turns the
  // zoom viewer on — which is a reward, not a refusal, so it is not what the gate measures.
  [CHANNEL.AMAZON]: { minLongEdgePx: 1000, bestLongEdgePx: 1600, aspect: null },
  // Flipkart: 1000px on the longest side for a listing image; no shape of its own.
  [CHANNEL.FLIPKART]: { minLongEdgePx: 1000, bestLongEdgePx: null, aspect: null },
  // Meesho: 1000px on the longest side, and the same free shape as Flipkart.
  [CHANNEL.MEESHO]: { minLongEdgePx: 1000, bestLongEdgePx: null, aspect: null },
  // Google Shopping: at least 100px for apparel, which nothing a phone takes will fail — so the
  // rule that bites is the 1000px its own guidance recommends for a usable listing image.
  [CHANNEL.GOOGLE]: { minLongEdgePx: 1000, bestLongEdgePx: null, aspect: null },
  // Meta: the feed is Google's, and a square is the shape a post is composed in.
  [CHANNEL.META]: { minLongEdgePx: 1080, bestLongEdgePx: null, aspect: 1 },
};

/**
 * How far a picture's shape may sit from a channel's before it counts as the wrong shape. A
 * photograph rounded to whole pixels is never exactly square, so zero tolerance would fail a
 * 1081×1080 image for a hundredth of nothing.
 */
export const ASPECT_TOLERANCE = 0.01;

/**
 * What one `enlarge` run aims at (spec A4): the largest long edge any channel with a rule asks
 * for, so a shop runs the tool once rather than once per marketplace. Derived from the table
 * above rather than typed, so a channel that wants more moves it by being added.
 */
export const ENLARGE_TARGET_LONG_EDGE = Math.max(
  ...Object.values(CHANNEL_IMAGE_RULES)
    .filter((rule): rule is ChannelImageRule => rule !== null)
    .map((rule) => rule.bestLongEdgePx ?? rule.minLongEdgePx),
);

export interface ChannelImageVerdict {
  ok: boolean;
  missing: ChannelImageProblem[];
  /** The one improvement that answers what is missing, or null where nothing here fixes it. */
  fix: EnhancementTool | null;
}

/**
 * Whether this image may go to this channel, and the tool that would make it fit (trd D7).
 *
 * Pure, and it takes the size rather than the asset, so no caller needs a row to ask. Size is
 * answered before shape: padding a too-small photograph onto white leaves it too small, while
 * enlarging a wrongly-shaped one leaves it wrongly shaped, and only one tool runs at a time
 * (spec R1). A square of white is how an aspect is met without cropping the product away.
 */
export function imageMeetsChannel(image: { width: number; height: number }, channel: Channel): ChannelImageVerdict {
  const rule = CHANNEL_IMAGE_RULES[channel];
  if (!rule) return { ok: true, missing: [], fix: null };

  const missing: ChannelImageProblem[] = [];
  if (Math.max(image.width, image.height) < rule.minLongEdgePx) {
    missing.push(CHANNEL_IMAGE_PROBLEM.TOO_SMALL);
  }
  if (rule.aspect !== null && image.height > 0 && Math.abs(image.width / image.height - rule.aspect) > ASPECT_TOLERANCE) {
    missing.push(CHANNEL_IMAGE_PROBLEM.WRONG_ASPECT);
  }

  const fix = missing.includes(CHANNEL_IMAGE_PROBLEM.TOO_SMALL)
    ? ENHANCEMENT_TOOL.ENLARGE
    : missing.includes(CHANNEL_IMAGE_PROBLEM.WRONG_ASPECT)
      ? ENHANCEMENT_TOOL.WHITE
      : null;
  return { ok: missing.length === 0, missing, fix };
}
