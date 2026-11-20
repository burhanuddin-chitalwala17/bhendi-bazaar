// Photographs are stored at each delivery width and served without an optimizer (ADR-0075).
// The writer (object-store.ts) and the reader (the image loader) must agree on every name, or a
// page asks for a file that was never written; that agreement is what this suite pins.
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { DELIVERY_WIDTHS, deliveryWidthFor, hasWidthCopies, isWidthCopyPath, widthPathFor } from "@server/catalog/image-widths";
import { MAX_IMAGE_EDGE } from "@server/catalog/media";
import nextConfig from "../../next.config";

const BASE = "https://images.example.test";

describe("width copy names", () => {
  it("puts each copy beside its original, always as WebP", () => {
    expect(widthPathFor("org/o1/bag/front-17.webp", 320)).toBe("org/o1/bag/front-17.w320.webp");
    expect(widthPathFor("videos/a/poster.jpg", 800)).toBe("videos/a/poster.w800.webp");
  });

  it("sizes raster photographs only, and never a copy of a copy", () => {
    expect(hasWidthCopies("a/b.webp")).toBe(true);
    expect(hasWidthCopies("a/b.JPEG")).toBe(true);
    expect(hasWidthCopies("a/b.gif")).toBe(false);
    expect(hasWidthCopies("a/b.svg")).toBe(false);
    expect(hasWidthCopies("videos/a/720.mp4")).toBe(false);
    expect(isWidthCopyPath("a/b.w320.webp")).toBe(true);
    expect(hasWidthCopies("a/b.w320.webp")).toBe(false);
  });

  it("picks the smallest copy at least as wide as asked, else the original", () => {
    expect(deliveryWidthFor(16)).toBe(320);
    expect(deliveryWidthFor(320)).toBe(320);
    expect(deliveryWidthFor(321)).toBe(800);
    expect(deliveryWidthFor(1200)).toBe(1200);
    expect(deliveryWidthFor(1201)).toBeNull();
  });
});

describe("the image loader", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("IMAGE_STORE_BASE_URL", BASE);
  });
  const load = async () => (await import("@/lib/image/loader")).default;

  it("sends one of our photographs to the copy that fits the slot", async () => {
    const loader = await load();
    const src = `${BASE}/org/o1/tote%20bag/front-17.webp`;
    expect(loader({ src, width: 256 })).toBe(`${BASE}/org/o1/tote%20bag/front-17.w320.webp`);
    expect(loader({ src, width: 640 })).toBe(`${BASE}/org/o1/tote%20bag/front-17.w800.webp`);
    expect(loader({ src, width: 2048 })).toBe(src);
  });

  it("serves anything that is not ours, or has no copies, exactly as given", async () => {
    const loader = await load();
    for (const src of ["https://i.ytimg.com/vi/abc/hqdefault.jpg", "/brand/logo.png", `${BASE}/a/b.gif`, `${BASE}/a/b.w320.webp`]) {
      expect(loader({ src, width: 320 })).toBe(src);
    }
  });

  it("serves the original when the build did not know the store", async () => {
    vi.stubEnv("IMAGE_STORE_BASE_URL", "");
    const loader = await load();
    expect(loader({ src: `${BASE}/a/b.webp`, width: 320 })).toBe(`${BASE}/a/b.webp`);
  });
});

describe("next.config routes every image through the loader", () => {
  it("uses the custom loader, not Vercel's optimizer", () => {
    expect(nextConfig.images?.loader).toBe("custom");
    expect(nextConfig.images?.loaderFile).toBe("./src/lib/image/loader.ts");
  });

  it("names in a srcset only widths a file exists for", () => {
    // A srcset width with no file behind it is a lie the browser would act on: it may pick that
    // entry thinking the file is that wide.
    expect(nextConfig.images?.deviceSizes).toEqual([...DELIVERY_WIDTHS, MAX_IMAGE_EDGE]);
    expect(nextConfig.images?.imageSizes).toEqual([]);
  });
});

describe("the object store writes and removes the copies", () => {
  const calls: { method: string; url: string; type: string | null; body?: Uint8Array }[] = [];

  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    vi.stubEnv("R2_PUBLIC_BASE_URL", BASE);
    vi.stubEnv("R2_ENDPOINT", "https://accountid.r2.cloudflarestorage.com");
    vi.stubEnv("R2_BUCKET", "bucket");
    vi.stubEnv("R2_ACCESS_KEY_ID", "id");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
    vi.stubGlobal("fetch", async (input: Request) => {
      const body = input.body ? new Uint8Array(await input.arrayBuffer()) : undefined;
      calls.push({ method: input.method, url: input.url, type: input.headers.get("content-type"), body });
      return new Response(null, { status: 200 });
    });
  });
  const load = () => import("@server/catalog/object-store");
  const photo = () => sharp({ create: { width: 1000, height: 500, channels: 3, background: "#c00" } }).webp().toBuffer();
  const puts = () => calls.filter((call) => call.method === "PUT");

  it("writes a photograph's copies with it, never wider than the original", async () => {
    const { putObject } = await load();
    await putObject("org/o1/bag/front.webp", await photo(), "image/webp");
    const written = puts().map((call) => new URL(call.url).pathname);
    expect(written).toEqual(
      expect.arrayContaining([
        "/bucket/org/o1/bag/front.webp",
        "/bucket/org/o1/bag/front.w320.webp",
        "/bucket/org/o1/bag/front.w800.webp",
        "/bucket/org/o1/bag/front.w1200.webp",
      ]),
    );
    expect(written).toHaveLength(4);
    const widths = await Promise.all(
      puts()
        .filter((call) => /\.w\d+\.webp$/.test(call.url))
        .map(async (call) => [new URL(call.url).pathname, (await sharp(call.body!).metadata()).width]),
    );
    expect(Object.fromEntries(widths)).toEqual({
      "/bucket/org/o1/bag/front.w320.webp": 320,
      "/bucket/org/o1/bag/front.w800.webp": 800,
      "/bucket/org/o1/bag/front.w1200.webp": 1000,
    });
  });

  it("writes no copies of a video or of a copy", async () => {
    const { putObject } = await load();
    await putObject("videos/a/720.mp4", Buffer.from("not a picture"), "video/mp4");
    await putObject("a/b.w320.webp", await photo(), "image/webp");
    expect(puts()).toHaveLength(2);
  });

  it("deletes the copies with the original", async () => {
    const { deleteObject } = await load();
    await deleteObject(`${BASE}/reviews/u1/a.webp`);
    expect(calls.filter((call) => call.method === "DELETE").map((call) => new URL(call.url).pathname).sort()).toEqual([
      "/bucket/reviews/u1/a.w1200.webp",
      "/bucket/reviews/u1/a.w320.webp",
      "/bucket/reviews/u1/a.w800.webp",
      "/bucket/reviews/u1/a.webp",
    ]);
  });

  it("makes missing copies from the stored original, and leaves complete ones alone", async () => {
    const original = await photo();
    let copiesExist = false;
    vi.stubGlobal("fetch", async (input: Request) => {
      calls.push({ method: input.method, url: input.url, type: null });
      if (input.method === "HEAD") return new Response(null, { status: copiesExist ? 200 : 404 });
      if (input.method === "GET") return new Response(new Uint8Array(original), { status: 200 });
      return new Response(null, { status: 200 });
    });
    const { ensureWidthCopies } = await load();
    expect(await ensureWidthCopies("a/b.webp")).toBe(true);
    expect(puts()).toHaveLength(DELIVERY_WIDTHS.length);

    calls.length = 0;
    copiesExist = true;
    expect(await ensureWidthCopies("a/b.webp")).toBe(false);
    expect(puts()).toHaveLength(0);
  });
});
