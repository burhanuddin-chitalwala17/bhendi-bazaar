/**
 * The player's two pure decisions (video-hosting trd D5, spec A3): which rendition a screen starts
 * on — 1080p wide, 720p narrow, the largest that exists otherwise — and how a playing time reads.
 */
import { describe, expect, it } from "vitest";
import { NARROW_RENDITION_KEY, WIDE_RENDITION_KEY, pickRendition } from "@/lib/video-renditions";
import { formatDuration } from "@/lib/format";
import { VIDEO_RENDITIONS } from "@server/catalog/video";

const r1080 = { key: "1080p", url: "https://img.test/clip-1080p.mp4", width: 1920, height: 1080 };
const r720 = { key: "720p", url: "https://img.test/clip-720p.mp4", width: 1280, height: 720 };

describe("pickRendition", () => {
  it("prefers the keys the worker declares, so a renamed rendition cannot orphan the choice", () => {
    expect(VIDEO_RENDITIONS.map((rendition) => rendition.key)).toEqual([WIDE_RENDITION_KEY, NARROW_RENDITION_KEY]);
  });

  it("starts a wide screen on 1080p and a phone on 720p", () => {
    expect(pickRendition([r1080, r720], true)).toBe(r1080);
    expect(pickRendition([r1080, r720], false)).toBe(r720);
  });

  it("plays the only rendition there is, whatever the screen", () => {
    expect(pickRendition([r720], true)).toBe(r720);
    expect(pickRendition([r720], false)).toBe(r720);
  });

  it("falls back to the largest when neither declared key is present, without reordering the input", () => {
    const odd = [{ ...r720, key: "480p", height: 480 }, { ...r1080, key: "custom", height: 900 }];
    expect(pickRendition(odd, true)?.key).toBe("custom");
    expect(pickRendition(odd, false)?.key).toBe("custom");
    expect(odd.map((rendition) => rendition.key)).toEqual(["480p", "custom"]);
  });

  it("has nothing to play for an empty list", () => {
    expect(pickRendition([], true)).toBeNull();
    expect(pickRendition([], false)).toBeNull();
  });
});

describe("formatDuration", () => {
  it("reads as minutes and zero-padded seconds", () => {
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(7_000)).toBe("0:07");
    expect(formatDuration(90_000)).toBe("1:30");
    expect(formatDuration(600_000)).toBe("10:00");
  });

  it("rounds to the nearest second and never goes negative", () => {
    expect(formatDuration(59_600)).toBe("1:00");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(-500)).toBe("0:00");
  });
});
