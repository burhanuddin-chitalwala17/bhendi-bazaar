// What the selection bar says after each bulk action (bulk-actions ux.md copy deck), and which
// items each action sends. Pure, so the copy is checked without rendering a grid.
import { describe, expect, it, vi } from "vitest";
import type { MediaAssetDto } from "@server/catalog/media-library.types";
import {
  planRetire,
  planTag,
  retireNotice,
  sendInBatches,
  tagNotice,
  zipNotice,
} from "@/components/org/library-bulk";
import { MEDIA_BULK_COPY as C } from "@/components/org/media-library-copy";

const base: MediaAssetDto = {
  id: "a0", kind: "IMAGE", ref: "/p0.jpg", width: 600, height: 1200, bytes: 2048, mimeType: "image/jpeg",
  source: "UPLOAD", state: "READY", uses: 0, derivedCount: 0, tags: [], createdAt: "2026-11-01T00:00:00Z",
  orgId: "org-1", retiredAt: null, retiredBy: null, retiredReason: null, poster: null, posterChosen: false,
  durationMs: null, renditions: [], failureReason: null,
};
const item = (id: string, extra: Partial<MediaAssetDto> = {}): MediaAssetDto => ({ ...base, id, ...extra });
const MB = 1024 * 1024;
const none = { links: 0, deleted: 0, gone: 0 };

describe("zipNotice", () => {
  it("12 photos and 1 link: one success that counts the link (spec A3)", () => {
    expect(zipNotice({ kind: "saved", saved: 12, total: 12, failedIds: [], ...none, links: 1 })).toEqual({
      tone: "success",
      title: C.zipDone(12),
      description: C.zipLinks(1),
    });
  });

  it("some failed: names both and offers only the failed ones again (Q13)", () => {
    const notice = zipNotice({ kind: "saved", saved: 10, total: 12, failedIds: ["x", "y"], ...none });
    expect(notice).toEqual({
      tone: "warning",
      title: C.zipPartial(10, 12),
      description: C.zipPartialFailed(2),
      retry: { label: C.zipRetry(2), ids: ["x", "y"] },
    });
  });

  it("says what was removed or no longer ours (Q16)", () => {
    const notice = zipNotice({ kind: "saved", saved: 3, total: 3, failedIds: [], links: 0, deleted: 2, gone: 1 });
    expect(notice?.description).toBe(`${C.zipRemoved(2)} ${C.zipNotOurs(1)}`);
  });

  it("over the limit with the server's numbers, and mid-download without them (J4, Q16)", () => {
    expect(zipNotice({ kind: "tooBig", totalBytes: 640 * MB, limitBytes: 500 * MB })).toEqual({
      tone: "error",
      title: C.zipTooBig("640 MB", "500 MB"),
      description: C.zipTooBigHint,
    });
    expect(zipNotice({ kind: "tooBig", totalBytes: null, limitBytes: 500 * MB })?.title).toBe(C.zipTooBigMidway);
  });

  it("never rounds a size down to the limit it is over", () => {
    expect(zipNotice({ kind: "tooBig", totalBytes: 500 * MB + 1, limitBytes: 500 * MB })?.title).toBe(
      C.zipTooBig("501 MB", "500 MB"),
    );
  });

  it("nothing fetched, nothing to zip, an error, and a cancel", () => {
    expect(zipNotice({ kind: "noneFetched", failedIds: ["a"], ...none })).toEqual({ tone: "error", title: C.zipNoneFetched });
    expect(zipNotice({ kind: "nothingToZip", ...none, links: 2 })).toEqual({
      tone: "warning",
      title: C.zipNothing,
      description: C.zipNothingHint,
    });
    expect(zipNotice({ kind: "error" }, ["a", "b"])).toEqual({
      tone: "error",
      title: C.unreachable,
      retry: { label: C.tryAgain, ids: ["a", "b"] },
    });
    expect(zipNotice({ kind: "cancelled" })).toBeNull();
  });
});

describe("planRetire", () => {
  it("5 selected, 2 used: confirms the 3 and counts the 2 (spec A4)", () => {
    const picked = ["a", "b", "c"].map((id) => item(id)).concat([item("d", { uses: 1 }), item("e", { uses: 2 })]);
    expect(planRetire(picked)).toEqual({ kind: "confirm", ids: ["a", "b", "c"], inUse: 2, alreadyRetired: 0 });
  });

  it("refuses with nothing selected, all retired, or all in use", () => {
    expect(planRetire([])).toEqual({ kind: "refused", notice: { tone: "error", title: C.nothingSelected } });
    expect(planRetire([item("a", { state: "RETIRED" })])).toEqual({
      kind: "refused",
      notice: { tone: "error", title: C.retiredOnlyDownload },
    });
    expect(planRetire([item("a", { uses: 1 }), item("b", { uses: 3 })])).toEqual({
      kind: "refused",
      notice: { tone: "error", title: C.retireAllUsed, description: C.retireAllUsedHint(2) },
    });
  });

  it("leaves retired items out of a mixed selection and counts them (R7)", () => {
    expect(planRetire([item("a"), item("r", { state: "RETIRED" })])).toEqual({
      kind: "confirm",
      ids: ["a"],
      inUse: 0,
      alreadyRetired: 1,
    });
  });
});

describe("retireNotice", () => {
  it("says what the server did, including what turned used meanwhile", () => {
    expect(retireNotice({ retired: ["a", "b"], inUse: ["c"], alreadyRetired: ["d"], notFound: [] }, 1)).toEqual({
      tone: "success",
      title: C.retireDone(2),
      description: `${C.retireTurnedUsed(1)} ${C.alreadyRetired(2)}`,
    });
  });

  it("when none could be retired after all, says so rather than 'Retired 0'", () => {
    expect(retireNotice({ retired: [], inUse: ["c"], alreadyRetired: [], notFound: [] }, 0)).toEqual({
      tone: "warning",
      title: C.retireAllUsed,
      description: C.retireTurnedUsed(1),
    });
  });
});

describe("planTag", () => {
  it("4 photos and 1 video: tags the 4 and counts the video (spec A5)", () => {
    const picked = ["a", "b", "c", "d"].map((id) => item(id)).concat(item("v", { kind: "VIDEO" }));
    expect(planTag(picked)).toEqual({ kind: "open", ids: ["a", "b", "c", "d"], videos: 1, retired: 0 });
  });

  it("leaves retired photos out of a mixed selection and counts them (R7)", () => {
    expect(planTag([item("a"), item("r", { state: "RETIRED" })])).toEqual({ kind: "open", ids: ["a"], videos: 0, retired: 1 });
  });

  it("refuses with nothing selected, no photos, or all retired", () => {
    expect(planTag([])).toEqual({ kind: "refused", notice: { tone: "error", title: C.nothingSelected } });
    expect(planTag([item("v", { kind: "VIDEO_EMBED" })])).toEqual({
      kind: "refused",
      notice: { tone: "error", title: C.tagNoPhotos },
    });
    expect(planTag([item("r", { state: "RETIRED" })])).toEqual({
      kind: "refused",
      notice: { tone: "error", title: C.retiredOnlyDownload },
    });
  });
});

describe("tagNotice", () => {
  it("names the tag, the count, and what was left out (J3)", () => {
    const outcome = { changed: ["a", "b", "c", "d"], notPhoto: [], retired: [], notFound: [] };
    expect(tagNotice(outcome, { on: true, tag: "Reference", videos: 1, retired: 0 })).toEqual({
      tone: "success",
      title: C.tagAdded(4, "Reference"),
      description: C.tagVideosLeftOut(1),
    });
    expect(tagNotice(outcome, { on: false, tag: "Reference", videos: 0, retired: 2 })).toEqual({
      tone: "success",
      title: C.tagRemoved(4, "Reference"),
      description: C.retiredOnlyDownload,
    });
  });
});

describe("sendInBatches (Q10)", () => {
  it("sends at most 100 ids a request, in order, and stops at the first failure", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id${i}`);
    const send = vi.fn(async (chunk: string[]) => chunk.length);
    expect(await sendInBatches(ids, send)).toEqual({ results: [100, 100, 50], failure: null });
    expect(send.mock.calls[1][0][0]).toBe("id100");

    const failing = vi.fn(async (chunk: string[]) => {
      if (chunk[0] === "id100") throw new Error("down");
      return chunk.length;
    });
    const partial = await sendInBatches(ids, failing);
    expect(partial.results).toEqual([100]);
    expect(partial.failure).toBeInstanceOf(Error);
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
