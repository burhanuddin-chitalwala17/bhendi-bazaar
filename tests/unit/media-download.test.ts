// The name a downloaded original is saved under (viewer spec R5, A5; trd D3).
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALLOWED_IMAGE_TYPES } from "@server/catalog/image-paths";
import { VIDEO_CONTENT_TYPES } from "@server/catalog/video";
import { downloadFilename } from "@server/catalog/media-download";
import { orgMediaApiClient } from "@/components/org/orgMediaApiClient";

describe("downloadFilename (viewer spec A5)", () => {
  it("is <shop code>-<asset id>.<ext>", () => {
    expect(downloadFilename("ORG-ABCDE", "cm123", "image/jpeg")).toBe("ORG-ABCDE-cm123.jpg");
  });

  it("names every type the library stores, and falls back to bin", () => {
    const expected: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
    };
    for (const type of [...ALLOWED_IMAGE_TYPES, ...VIDEO_CONTENT_TYPES]) {
      expect(downloadFilename("ORG-A", "id", type)).toBe(`ORG-A-id.${expected[type]}`);
    }
    expect(downloadFilename("ORG-A", "id", null)).toBe("ORG-A-id.bin");
    expect(downloadFilename("ORG-A", "id", "application/x-unknown")).toBe("ORG-A-id.bin");
  });

  // A quote or non-ASCII byte would break the unencoded disposition header (trd D3).
  it("stays plain ASCII without quotes, whatever the code holds", () => {
    const name = downloadFilename('SEL "1"/é', "id", "image/png");
    expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe("orgMediaApiClient.canDownload (viewer trd D5)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks the download route with HEAD, and resolves when the file can be saved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(orgMediaApiClient.canDownload("org1", "asset1")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/org/org1/media/asset1/download");
    expect(init.method).toBe("HEAD");
  });

  // A HEAD reply has no body, so the status is what the toast is chosen by.
  it("rejects with the status of a refusal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 410 })));
    await expect(orgMediaApiClient.canDownload("org1", "asset1")).rejects.toMatchObject({ status: 410 });
  });
});
