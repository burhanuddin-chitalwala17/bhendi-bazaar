// The one place the browser reads our bucket's bytes (bulk-actions trd D5, D7).
import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaFilesApiClient } from "@/components/org/mediaFilesApiClient";

afterEach(() => vi.unstubAllGlobals());

describe("mediaFilesApiClient.open", () => {
  it("answers the body stream of a presigned GET, sending no cookies to the bucket", async () => {
    const fetchMock = vi.fn(async () => new Response("bytes", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const stream = await mediaFilesApiClient.open("https://r2.example/a?sig", new AbortController().signal);
    expect(await new Response(stream).text()).toBe("bytes");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://r2.example/a?sig");
    expect(init.credentials).toBe("omit");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("an expired or refused link is a failure, not an empty file", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<Error/>", { status: 403 })));
    await expect(mediaFilesApiClient.open("https://r2.example/a", new AbortController().signal)).rejects.toThrow("403");
  });
});
