// The seam every image goes through (ADR-0028). What is worth pinning here is the URL
// arithmetic and the presigning contract — the parts that decide whether a stored
// object can be found again, and whether a browser can widen the permission it was
// given.
import { beforeEach, describe, expect, it, vi } from "vitest";

const BASE = "https://images.example.test";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("R2_PUBLIC_BASE_URL", BASE);
  vi.stubEnv("R2_ENDPOINT", "https://accountid.r2.cloudflarestorage.com");
  vi.stubEnv("R2_BUCKET", "bhendi-bazaar");
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-key-id");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
});

const load = () => import("@server/catalog/object-store");

describe("publicUrlFor", () => {
  it("encodes each segment but keeps the path structure", async () => {
    const { publicUrlFor } = await load();
    expect(publicUrlFor("products/org-a/tote bag/front.webp")).toBe(
      `${BASE}/products/org-a/tote%20bag/front.webp`
    );
  });

  it("tolerates a base URL with a trailing slash", async () => {
    vi.stubEnv("R2_PUBLIC_BASE_URL", `${BASE}/`);
    const { publicUrlFor } = await load();
    expect(publicUrlFor("a/b.webp")).toBe(`${BASE}/a/b.webp`);
  });
});

describe("pathnameFor", () => {
  it("round-trips a URL this store produced, spaces included", async () => {
    const { publicUrlFor, pathnameFor } = await load();
    const path = "products/org-a/tote bag/front.webp";
    expect(pathnameFor(publicUrlFor(path))).toBe(path);
  });

  it("returns null for a URL from somewhere else, rather than guessing a path", async () => {
    const { pathnameFor } = await load();
    // A delete driven by a guessed pathname would remove the wrong object.
    expect(pathnameFor("https://other.example.test/products/x.webp")).toBeNull();
    expect(pathnameFor("https://i.ytimg.com/vi/abc/0.jpg")).toBeNull();
  });
});

describe("presignUpload", () => {
  it("signs the path, and binds the type and the exact length", async () => {
    const { presignUpload } = await load();
    const { uploadUrl, publicUrl } = await presignUpload(
      "categories/bulk/hero.webp",
      "image/webp",
      12345
    );

    const signed = new URL(uploadUrl);
    // Points at the bucket, not at the public domain — the browser PUTs to the S3 API.
    expect(signed.host).toBe("accountid.r2.cloudflarestorage.com");
    expect(signed.pathname).toBe("/bhendi-bazaar/categories/bulk/hero.webp");
    expect(signed.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(signed.searchParams.get("X-Amz-Expires")).toBe("600");

    // Signed, so the browser cannot change it after we approved it.
    const headers = signed.searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(headers).toContain("content-type");

    // Size is NOT signed and cannot be: Content-Length is a forbidden header, so the
    // Request constructor drops it, and S3 PUT has no content-length-range. Pinned so
    // that nobody later reads the `size` argument as an enforced bound (ADR-0028).
    expect(headers).not.toContain("content-length");

    expect(publicUrl).toBe(`${BASE}/categories/bulk/hero.webp`);
  });

  it("refuses a size that is not a positive whole number of bytes", async () => {
    const { presignUpload } = await load();
    for (const size of [0, -1, 1.5, Number.NaN]) {
      await expect(presignUpload("a/b.webp", "image/webp", size)).rejects.toThrow(
        /positive whole number/
      );
    }
  });
});

// This predicate is a security control, not a formality: it is the only thing stopping a
// crafted bulk payload from pointing a product at an arbitrary image on the internet.
// It had NO test coverage before ADR-0028 — the integration suite calls the bulk service
// directly and never reaches the route schema — which is why a hardcoded Vercel Blob
// hostname survived the migration and would have rejected every R2 upload.
describe("isOwnObjectUrl", () => {
  it("accepts a URL under the configured public base", async () => {
    const { isOwnObjectUrl, publicUrlFor } = await load();
    expect(isOwnObjectUrl(publicUrlFor("products/org-a/x/front.webp"))).toBe(true);
  });

  it("rejects the retired store — the case that broke the migration", async () => {
    const { isOwnObjectUrl } = await load();
    expect(
      isOwnObjectUrl("https://o42adyjkazl35sk2.public.blob.vercel-storage.com/products/x.jpg")
    ).toBe(false);
  });

  it("rejects an arbitrary external URL, which is the point of it", async () => {
    const { isOwnObjectUrl } = await load();
    for (const url of [
      "https://evil.example.test/tracker.png",
      // A prefix that merely starts the same must not pass as containment.
      "https://images.example.test.evil.test/x.webp",
      "not a url at all",
    ]) {
      expect(isOwnObjectUrl(url), url).toBe(false);
    }
  });
});

// Pins the wiring, not just the predicate: the schema is what the route actually calls.
describe("bulk category create schema", () => {
  const row = (imageUrl: string) => ({
    rows: [
      {
        name: "Abayas",
        description: "Everyday abayas",
        image: "abayas.jpg",
        imageUrl,
      },
    ],
  });

  it("accepts an image URL from our own store", async () => {
    const { publicUrlFor } = await load();
    const { bulkCategoryCreateSchema } = await import(
      "@/lib/validation/schemas/bulk-category.schema"
    );
    expect(
      bulkCategoryCreateSchema.safeParse(row(publicUrlFor("categories/bulk/abayas.webp"))).success
    ).toBe(true);
  });

  it("refuses one from anywhere else", async () => {
    const { bulkCategoryCreateSchema } = await import(
      "@/lib/validation/schemas/bulk-category.schema"
    );
    const result = bulkCategoryCreateSchema.safeParse(row("https://evil.example.test/x.png"));
    expect(result.success).toBe(false);
  });
});
