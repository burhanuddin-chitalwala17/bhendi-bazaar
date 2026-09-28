// A hosted video is transcoded by the worker into the declared renditions plus a poster, and a
// clip past the limit is refused with the limit named (docs/specs/media-library/video-hosting/,
// trd D3, D4; ADR-0039). The encode itself runs only where ffmpeg is installed.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { VIDEO_LIMITS, VIDEO_RENDITIONS, describeDurationLimit, describeSizeLimit } from "@server/catalog/video";
import {
  assertWithinLimits,
  isQuarterTurned,
  hasTranscoder,
  probeVideo,
  renditionsFor,
  transcodeVideo,
  withTranscodeLock,
} from "@server/catalog/video-transcode";

const run = promisify(execFile);

describe("the declared limits", () => {
  it("are named from the same constants the checks read", () => {
    expect(describeDurationLimit()).toBe("at most 90 seconds");
    expect(describeSizeLimit()).toBe("at most 200 MB");
    expect(VIDEO_RENDITIONS.map((r) => r.key)).toEqual(["1080p", "720p"]);
  });

  it("refuse a clip past the duration with the limit in the message, and pass one within it", () => {
    expect(() => assertWithinLimits({ durationMs: VIDEO_LIMITS.maxDurationMs + 1000, width: 1920, height: 1080 })).toThrow(/at most 90 seconds/);
    expect(() => assertWithinLimits({ durationMs: VIDEO_LIMITS.maxDurationMs, width: 1920, height: 1080 })).not.toThrow();
  });

  it("pick no rendition taller than the source, and always the smallest for a tiny source", () => {
    expect(renditionsFor(2160).map((r) => r.key)).toEqual(["1080p", "720p"]);
    expect(renditionsFor(720).map((r) => r.key)).toEqual(["720p"]);
    expect(renditionsFor(480).map((r) => r.key)).toEqual(["720p"]);
  });

  it("the transcode lock runs work one after the other, and a failure does not jam it", async () => {
    const order: string[] = [];
    const slow = withTranscodeLock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push("first");
    });
    const failing = withTranscodeLock(async () => {
      order.push("second");
      throw new Error("boom");
    });
    const last = withTranscodeLock(async () => order.push("third"));
    await slow;
    await expect(failing).rejects.toThrow("boom");
    await last;
    expect(order).toEqual(["first", "second", "third"]);
  });
});

describe("transcoding a real clip", async () => {
  const available = await hasTranscoder();
  let dir = "";

  it("never skips in CI — the worker image ships ffmpeg, so the test job installs it too", () => {
    if (process.env.CI) expect(available, "ffmpeg is missing from the CI test job").toBe(true);
    else expect(typeof available).toBe("boolean");
  });

  beforeAll(async () => {
    if (!available) return;
    dir = await mkdtemp(join(tmpdir(), "bb-video-"));
    await run("ffmpeg", [
      "-y", "-v", "error",
      "-f", "lavfi", "-i", "testsrc=duration=2:size=1280x720:rate=24",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
      join(dir, "source.mp4"),
    ]);
  });
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it.skipIf(!available)("probes duration and size, then makes the fitting renditions and a poster", async () => {
    const probe = await probeVideo(join(dir, "source.mp4"));
    expect(probe.width).toBe(1280);
    expect(probe.height).toBe(720);
    expect(probe.durationMs).toBeGreaterThan(1500);
    expect(probe.durationMs).toBeLessThan(2500);

    const result = await transcodeVideo(join(dir, "source.mp4"), dir, probe);
    expect(result.renditions.map((r) => r.key)).toEqual(["720p"]);
    expect(result.renditions[0]).toMatchObject({ width: 1280, height: 720, mimeType: "video/mp4" });
    expect(result.renditions[0].bytes).toBeGreaterThan(0);
    expect(result.poster).toMatchObject({ width: 1280, height: 720, mimeType: "image/jpeg" });
    expect(result.poster.bytes).toBeGreaterThan(0);
  });

  it.skipIf(!available)("a file with no video stream is refused as unreadable", async () => {
    await expect(probeVideo(join(dir, "missing.mp4"))).rejects.toThrow(/No such file|ffprobe|Invalid data/);
  });
});

describe("a turned clip", () => {
  it("is measured as it will be shown, whether the turn is in the matrix or an old tag", () => {
    expect(isQuarterTurned({ side_data_list: [{ rotation: -90 }] })).toBe(true);
    expect(isQuarterTurned({ side_data_list: [{ rotation: 270 }] })).toBe(true);
    expect(isQuarterTurned({ side_data_list: [{ rotation: 180 }] })).toBe(false);
    expect(isQuarterTurned({ side_data_list: [{ rotation: 0 }] })).toBe(false);
    expect(isQuarterTurned({ tags: { rotate: "90" } })).toBe(true);
    expect(isQuarterTurned({ tags: { rotate: "180" } })).toBe(false);
    expect(isQuarterTurned({})).toBe(false);
    // A phone films landscape and says "turn this": the stream is 320x240 and the picture is 240x320.
    expect(isQuarterTurned({ side_data_list: [{ rotation: -90 }], tags: { rotate: "0" } })).toBe(true);
  });
});
