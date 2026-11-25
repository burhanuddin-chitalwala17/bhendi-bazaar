// The one place the browser reads our bucket's bytes (bulk-actions trd D5, D7).
import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaFilesApiClient } from "@/components/org/mediaFilesApiClient";
import { TRANSFER_TIMEOUT_MS } from "@/lib/api-client";

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

  it("adds its own deadline to the caller's cancel, so a stalled file fails (Q13)", async () => {
    const deadlines: AbortController[] = [];
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      deadlines.push(new AbortController());
      return deadlines.at(-1)!.signal;
    });
    const fetchMock = vi.fn(async () => new Response("x"));
    vi.stubGlobal("fetch", fetchMock);
    const caller = new AbortController();
    const signalOf = (call: number) => (fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1].signal!;
    try {
      await mediaFilesApiClient.open("https://r2.example/a", caller.signal);
      expect(timeout).toHaveBeenCalledWith(TRANSFER_TIMEOUT_MS);
      expect(signalOf(0).aborted).toBe(false);
      deadlines[0].abort();
      expect(signalOf(0).aborted).toBe(true);

      await mediaFilesApiClient.open("https://r2.example/b", caller.signal);
      caller.abort();
      expect(signalOf(1).aborted).toBe(true);
    } finally {
      timeout.mockRestore();
    }
  });

  it("an expired or refused link is a failure, not an empty file", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<Error/>", { status: 403 })));
    await expect(mediaFilesApiClient.open("https://r2.example/a", new AbortController().signal)).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
    });
  });
});
