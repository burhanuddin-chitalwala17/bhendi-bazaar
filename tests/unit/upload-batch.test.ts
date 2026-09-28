// One batch uploader for every gallery and the library (ADR-0026, ADR-0028): every file is
// downscaled and checked before any is sent, results stay aligned with the files given, failures
// are named rather than thrown, duplicates the org already held are counted, and a crop's source
// travels with every file in its batch (media-library trd D6a).
import { beforeEach, describe, expect, it, vi } from "vitest";

const downscale = vi.fn(async (file: File) => file);
const problem = vi.fn((_file: { type: string; size: number }): string | null => null);
const direct = vi.fn();
vi.mock("@/lib/image/downscale", () => ({ downscaleImage: (file: File) => downscale(file) }));
vi.mock("@server/catalog/image-paths", () => ({ imageFileProblem: (file: { type: string; size: number }) => problem(file) }));
vi.mock("@/lib/image/upload-direct", () => ({ uploadDirect: (...args: unknown[]) => direct(...args) }));

const { uploadBatch, UPLOAD_CONCURRENCY } = await import("@/lib/image/upload-batch");

const file = (name: string) => new File(["x"], name, { type: "image/webp" });
const endpoints = { token: "/t", confirm: "/c" };
const landed = (url: string, assetId: string | null = "a1", reused = false) => ({ url, assetId, reused });

beforeEach(() => {
  vi.clearAllMocks();
  problem.mockReturnValue(null);
});

describe("uploadBatch", () => {
  it("downscales and checks every file before sending any, and refuses the batch whole on a bad one", async () => {
    problem.mockReturnValueOnce(null).mockReturnValueOnce("Too large");
    await expect(uploadBatch([file("a.webp"), file("b.webp")], { endpoints, pathFor: (f) => f.name })).rejects.toThrow("Too large");
    expect(downscale).toHaveBeenCalledTimes(2);
    expect(direct).not.toHaveBeenCalled();
  });

  it("keeps URLs and asset ids aligned with the files, names what failed, and counts what was already held", async () => {
    direct
      .mockImplementationOnce(async () => landed("https://img.test/a.webp", "a1"))
      .mockImplementationOnce(async () => {
        throw new Error("network down");
      })
      .mockImplementationOnce(async () => landed("https://img.test/old.webp", "old", true));
    const seen: [number, number][] = [];
    const result = await uploadBatch([file("a.webp"), file("b.webp"), file("c.webp")], {
      endpoints,
      pathFor: (f) => `products/org/${f.name}`,
      onProgress: (done, total) => seen.push([done, total]),
      concurrency: 1,
    });
    expect(result.urls).toEqual(["https://img.test/a.webp", undefined, "https://img.test/old.webp"]);
    expect(result.assetIds).toEqual(["a1", null, "old"]);
    expect(result.failed).toEqual(["b.webp"]);
    expect(result.firstError).toBe("network down");
    expect(result.reused).toBe(1);
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(direct).toHaveBeenNthCalledWith(1, "products/org/a.webp", expect.any(File), endpoints, expect.any(Object));
  });

  it("records no asset id where the route registered none", async () => {
    direct.mockResolvedValue(landed("https://img.test/r.webp", null));
    const result = await uploadBatch([file("r.webp")], { endpoints: { token: "/t" }, pathFor: (f) => f.name });
    expect(result.urls).toEqual(["https://img.test/r.webp"]);
    expect(result.assetIds).toEqual([null]);
  });

  it("hands the source a crop derives from to every upload in the batch", async () => {
    direct.mockResolvedValue(landed("https://img.test/a-crop.webp", "d1"));
    const derivedFrom = { assetId: "src-1", transform: { rotation: 0 as const, crop: { x: 0, y: 0, width: 10, height: 10 } } };
    await uploadBatch([file("a-crop.webp")], { endpoints, pathFor: (f) => f.name, derivedFrom });
    expect(direct).toHaveBeenCalledWith("a-crop.webp", expect.any(File), endpoints, { derivedFrom });
  });

  it("never has more uploads in flight than the concurrency allows", async () => {
    let inFlight = 0;
    let peak = 0;
    direct.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return landed("https://img.test/x.webp");
    });
    await uploadBatch(Array.from({ length: 8 }, (_, i) => file(`${i}.webp`)), { endpoints, pathFor: (f) => f.name });
    expect(peak).toBeLessThanOrEqual(UPLOAD_CONCURRENCY);
    expect(peak).toBeGreaterThan(1);
  });
});
