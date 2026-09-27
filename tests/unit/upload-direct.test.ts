/**
 * The browser side of trd D2: register, PUT, confirm — and no confirm for a route that
 * registered nothing, which is how review photographs keep working untouched. The result names
 * the asset behind the URL, so a crop can be registered as derived from it (trd D6a), and a
 * duplicate the org already held comes back as that asset without a byte moving (D11).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadDirect } from "@/lib/image/upload-direct";

const calls: { url: string; init?: RequestInit }[] = [];
const respond = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body, text: async () => "" }) as unknown as Response;

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/token")) return respond({ uploadUrl: "https://r2/put", publicUrl: "https://img.test/a.webp", assetId: "a1" });
      if (url === "/api/reviews/upload-token") return respond({ uploadUrl: "https://r2/put", publicUrl: "https://img.test/r.webp" });
      if (url === "https://r2/put") return respond({});
      if (url.endsWith("/confirm")) return respond({ assetId: "a1", ref: "https://img.test/a.webp", alreadyReady: false });
      throw new Error(`unexpected ${url}`);
    }),
  );
});

const file = new File(["bytes"], "a.webp", { type: "image/webp" });
const endpoints = { token: "/api/org/o1/upload/token", confirm: "/api/org/o1/upload/confirm" };

describe("uploadDirect", () => {
  it("registers, uploads, then confirms with the asset id — and hands the id back", async () => {
    const result = await uploadDirect("p/a.webp", file, endpoints);
    expect(result).toEqual({ url: "https://img.test/a.webp", assetId: "a1", reused: false });
    expect(calls.map((c) => c.url)).toEqual(["/api/org/o1/upload/token", "https://r2/put", "/api/org/o1/upload/confirm"]);
    expect(JSON.parse(String(calls[2].init?.body))).toMatchObject({ assetId: "a1" });
    expect(JSON.parse(String(calls[0].init?.body))).not.toHaveProperty("derivedFrom");
  });

  it("skips the confirm when the route registered no asset, and says so", async () => {
    const result = await uploadDirect("r.webp", file, { token: "/api/reviews/upload-token" });
    expect(result).toEqual({ url: "https://img.test/r.webp", assetId: null, reused: false });
    expect(calls.map((c) => c.url)).toEqual(["/api/reviews/upload-token", "https://r2/put"]);
  });

  it("sends the source a crop derives from with the permission request", async () => {
    const derivedFrom = { assetId: "src-1", transform: { rotation: 90 as const, crop: { x: 1, y: 2, width: 30, height: 40 } } };
    await uploadDirect("p/a-crop.webp", file, endpoints, { derivedFrom });
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ pathname: "p/a-crop.webp", derivedFrom });
  });

  it("uploads nothing when the org already holds these bytes, and returns that asset", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith("/token")) return respond({ duplicate: { assetId: "old", ref: "https://img.test/old.webp", width: 1, height: 1 } });
      throw new Error(`unexpected ${String(url)}`);
    });
    const result = await uploadDirect("p/a.webp", file, endpoints);
    expect(result).toEqual({ url: "https://img.test/old.webp", assetId: "old", reused: true });
  });

  it("treats a failed confirm as a failed upload", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith("/token")) return respond({ uploadUrl: "https://r2/put", publicUrl: "x", assetId: "a1" });
      if (u === "https://r2/put") return respond({});
      return { ok: false, status: 409, json: async () => ({ error: "The image has not reached the store yet." }), text: async () => "" } as unknown as Response;
    });
    await expect(uploadDirect("p/a.webp", file, { token: "/t/token", confirm: "/t/confirm" })).rejects.toThrow(/not reached the store/);
  });
});
