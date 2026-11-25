// The browser's zip of a library selection (bulk-actions trd D6): stored, one file at a time, a failed
// fetch skipped and reported (Q13), real bytes held to the limit because a legacy row has no size (D4).
import { describe, expect, it, vi } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { buildZip, ZipLimitError, type ZipEntry } from "@/lib/zip/build-zip";

const enc = new TextEncoder();

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(enc.encode(chunk));
      controller.close();
    },
  });
}

function failingAfter(chunk: string): ReadableStream<Uint8Array> {
  let sent = false;
  return new ReadableStream({
    pull(controller) {
      if (sent) controller.error(new TypeError("network"));
      else {
        sent = true;
        controller.enqueue(enc.encode(chunk));
      }
    },
  });
}

async function entriesOf(blob: Blob): Promise<Record<string, string>> {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, strFromU8(bytes)]));
}

const entry = (id: string): ZipEntry => ({ id, filename: `shop-${id}.jpg` });

describe("buildZip", () => {
  it("zips every file in order under its download name, each original byte for byte (spec A3)", async () => {
    const bodies: Record<string, string[]> = { a: ["he", "llo"], b: ["wor", "ld"], c: [""] };
    const progress: [number, number][] = [];
    const result = await buildZip([entry("a"), entry("b"), entry("c")], {
      open: async (e) => streamOf(...bodies[e.id]),
      limitBytes: 1000,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(result.added).toEqual(["a", "b", "c"]);
    expect(result.failed).toEqual([]);
    expect(result.blob?.type).toBe("application/zip");
    const files = await entriesOf(result.blob!);
    expect(Object.keys(files)).toEqual(["shop-a.jpg", "shop-b.jpg", "shop-c.jpg"]);
    expect(files).toEqual({ "shop-a.jpg": "hello", "shop-b.jpg": "world", "shop-c.jpg": "" });
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it("skips a file whose fetch fails, before or halfway, and reports it — no truncated entry (Q13)", async () => {
    const result = await buildZip([entry("a"), entry("b"), entry("c")], {
      open: async (e) => {
        if (e.id === "a") throw new TypeError("Failed to fetch");
        if (e.id === "b") return failingAfter("half");
        return streamOf("whole");
      },
      limitBytes: 1000,
    });
    expect(result.added).toEqual(["c"]);
    expect(result.failed).toEqual(["a", "b"]);
    expect(await entriesOf(result.blob!)).toEqual({ "shop-c.jpg": "whole" });
  });

  it("makes no blob when nothing arrived", async () => {
    const result = await buildZip([entry("a")], {
      open: async () => {
        throw new TypeError("Failed to fetch");
      },
      limitBytes: 1000,
    });
    expect(result).toEqual({ blob: null, added: [], failed: ["a"] });
  });

  it("refuses once the real bytes pass the limit, though no size was declared (trd D4)", async () => {
    const open = vi.fn(async () => streamOf("12345", "67890"));
    const zipping = buildZip([entry("a"), entry("b"), entry("c")], { open, limitBytes: 15 });
    await expect(zipping).rejects.toBeInstanceOf(ZipLimitError);
    await expect(zipping).rejects.toMatchObject({ limitBytes: 15 });
    // Stopped on the second file: the third is never fetched.
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("holds exactly the limit", async () => {
    const result = await buildZip([entry("a"), entry("b")], { open: async () => streamOf("12345"), limitBytes: 10 });
    expect(result.added).toEqual(["a", "b"]);
  });

  it("cancel stops the fetch in flight and leaves no blob (trd D6)", async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    const open = vi.fn(async (e: ZipEntry, signal: AbortSignal) => {
      seen = signal;
      if (e.id === "a") return streamOf("first");
      controller.abort();
      return streamOf("second");
    });
    const zipping = buildZip([entry("a"), entry("b"), entry("c")], { open, limitBytes: 1000, signal: controller.signal });
    await expect(zipping).rejects.toMatchObject({ name: "AbortError" });
    expect(seen?.aborted).toBe(true);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("an already-cancelled build fetches nothing", async () => {
    const open = vi.fn(async () => streamOf("x"));
    const controller = new AbortController();
    controller.abort();
    await expect(buildZip([entry("a")], { open, limitBytes: 10, signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(open).not.toHaveBeenCalled();
  });
});
