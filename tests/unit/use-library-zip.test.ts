// useLibraryZip (bulk-actions trd D6, D7): asks for links, zips what has a file, saves it under the
// Q11 name, and answers an outcome the selection bar turns into ux copy. It never toasts.
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";

const h = vi.hoisted(() => ({ downloadLinks: vi.fn(), open: vi.fn(), saveBlob: vi.fn() }));

vi.mock("@/components/org/orgMediaApiClient", () => ({ orgMediaApiClient: { downloadLinks: h.downloadLinks } }));
vi.mock("@/components/org/mediaFilesApiClient", () => ({ mediaFilesApiClient: { open: h.open } }));
vi.mock("@/lib/browser-navigation", () => ({ saveBlob: h.saveBlob }));

import { libraryZipName, useLibraryZip } from "@/components/org/useLibraryZip";

const enc = new TextEncoder();
const streamOf = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(text));
      c.close();
    },
  });

const file = (id: string) => ({ id, url: `https://r2.example/${id}?sig`, filename: `shop-${id}.jpg`, bytes: 3 });
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const NOW = new Date(2026, 10, 24, 15, 0);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  h.open.mockImplementation(async (url: string) => streamOf(url.slice(-6)));
});

async function run(hook: { current: ReturnType<typeof useLibraryZip> }, selected: string[]) {
  let outcome!: Awaited<ReturnType<ReturnType<typeof useLibraryZip>["download"]>>;
  await act(async () => {
    outcome = await hook.current.download(selected);
  });
  return outcome;
}

describe("libraryZipName (Q11)", () => {
  it("is <shop code>-library-<local date>.zip", () => {
    expect(libraryZipName("BBZ01", NOW)).toBe("BBZ01-library-2026-11-24.zip");
  });
  it("falls back to library-<date>.zip without a code, and strips what a filename cannot hold", () => {
    expect(libraryZipName(null, NOW)).toBe("library-2026-11-24.zip");
    expect(libraryZipName("a/b c", NOW)).toBe("a-b-c-library-2026-11-24.zip");
  });
});

describe("useLibraryZip", () => {
  it("12 photos and 1 YouTube link save one zip of 12 and count the link (spec A3)", async () => {
    const photos = ids(12);
    h.downloadLinks.mockResolvedValue({ files: photos.map(file), noFile: [{ id: "yt", reason: "link" }], totalBytes: 36 });
    const { result } = renderHook(() => useLibraryZip("org-1", "BBZ01"));
    const outcome = await run(result, [...photos, "yt"]);

    expect(h.downloadLinks).toHaveBeenCalledWith("org-1", [...photos, "yt"]);
    expect(outcome).toEqual({ kind: "saved", saved: 12, total: 12, failedIds: [], links: 1, deleted: 0, gone: 0 });
    expect(h.saveBlob).toHaveBeenCalledTimes(1);
    const [blob, name] = h.saveBlob.mock.calls[0];
    expect(name).toBe("BBZ01-library-2026-11-24.zip");
    expect((blob as Blob).type).toBe("application/zip");
    expect(h.open).toHaveBeenCalledTimes(12);
    expect(result.current.progress).toBeNull();
  });

  it("over the limit answers the server's numbers and fetches nothing (Q4)", async () => {
    h.downloadLinks.mockRejectedValue(
      new ApiError("too big", 422, [
        { path: "totalBytes", message: "671088640" },
        { path: "limitBytes", message: "524288000" },
      ]),
    );
    const { result } = renderHook(() => useLibraryZip("org-1", "BBZ01"));
    expect(await run(result, ids(3))).toEqual({ kind: "tooBig", totalBytes: 671088640, limitBytes: 524288000 });
    expect(h.open).not.toHaveBeenCalled();
    expect(h.saveBlob).not.toHaveBeenCalled();
  });

  it("a server it cannot reach is an error with nothing changed", async () => {
    h.downloadLinks.mockRejectedValue(new ApiError("offline", 0));
    const { result } = renderHook(() => useLibraryZip("org-1", null));
    expect(await run(result, ids(2))).toEqual({ kind: "error" });
  });

  it("saves what arrived and names the ids that did not, for a second zip of only those (Q13)", async () => {
    h.downloadLinks.mockResolvedValue({ files: ids(3).map(file), noFile: [], totalBytes: 9 });
    h.open.mockImplementation(async (url: string) => {
      if (url.includes("p2")) throw new TypeError("Failed to fetch");
      return streamOf("abc");
    });
    const { result } = renderHook(() => useLibraryZip("org-1", "BBZ01"));
    expect(await run(result, ids(3))).toMatchObject({ kind: "saved", saved: 2, total: 3, failedIds: ["p2"] });
    expect(h.saveBlob).toHaveBeenCalledTimes(1);
  });

  it("nothing fetched saves nothing", async () => {
    h.downloadLinks.mockResolvedValue({ files: ids(2).map(file), noFile: [{ id: "d", reason: "deleted" }], totalBytes: 6 });
    h.open.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useLibraryZip("org-1", "BBZ01"));
    expect(await run(result, [...ids(2), "d", "x"])).toEqual({
      kind: "noneFetched",
      failedIds: ["p1", "p2"],
      links: 0,
      deleted: 1,
      gone: 1,
    });
    expect(h.saveBlob).not.toHaveBeenCalled();
  });

  it("only links and gone items: nothing to zip, nothing fetched", async () => {
    h.downloadLinks.mockResolvedValue({ files: [], noFile: [{ id: "yt", reason: "link" }], totalBytes: 0 });
    const { result } = renderHook(() => useLibraryZip("org-1", "BBZ01"));
    expect(await run(result, ["yt", "x"])).toEqual({ kind: "nothingToZip", links: 1, deleted: 0, gone: 1 });
    expect(h.open).not.toHaveBeenCalled();
  });

  it("the real bytes passing the limit are refused like the server's cap (trd D4)", async () => {
    h.downloadLinks.mockResolvedValue({ files: [{ ...file("p1"), bytes: null }], noFile: [], totalBytes: 0 });
    h.open.mockImplementation(async () => streamOf("x".repeat(64)));
    const { result } = renderHook(() => useLibraryZip("org-1", "BBZ01", 32));
    expect(await run(result, ["p1"])).toMatchObject({ kind: "tooBig", limitBytes: 32 });
    expect(h.saveBlob).not.toHaveBeenCalled();
  });

  it("cancel aborts the fetch in flight, saves nothing and clears progress (trd D6)", async () => {
    h.downloadLinks.mockResolvedValue({ files: ids(2).map(file), noFile: [], totalBytes: 6 });
    let signal!: AbortSignal;
    let opened!: () => void;
    const started = new Promise<void>((r) => (opened = r));
    h.open.mockImplementation(
      (_url: string, s: AbortSignal) =>
        new Promise((_, reject) => {
          signal = s;
          s.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          opened();
        }),
    );
    const { result } = renderHook(() => useLibraryZip("org-1", "BBZ01"));
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.download(ids(2));
    });
    await act(async () => {
      await started;
    });
    expect(result.current.progress).toEqual({ done: 0, total: 2 });
    act(() => result.current.cancel());
    await act(async () => {
      expect(await pending).toEqual({ kind: "cancelled" });
    });
    expect(signal.aborted).toBe(true);
    expect(h.saveBlob).not.toHaveBeenCalled();
    expect(result.current.progress).toBeNull();
  });

  it("a second tap while building joins the first", async () => {
    h.downloadLinks.mockResolvedValue({ files: [file("p1")], noFile: [], totalBytes: 3 });
    const { result } = renderHook(() => useLibraryZip("org-1", "BBZ01"));
    await act(async () => {
      await Promise.all([result.current.download(["p1"]), result.current.download(["p1"])]);
    });
    expect(h.downloadLinks).toHaveBeenCalledTimes(1);
    expect(h.saveBlob).toHaveBeenCalledTimes(1);
  });
});
