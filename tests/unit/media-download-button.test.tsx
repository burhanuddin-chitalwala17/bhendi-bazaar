// The Library's Download (viewer spec R5, R6; trd D4, D5): an anchor to the download route, asked
// with HEAD first so a refusal is our toast rather than the browser's error page.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api-error";

const h = vi.hoisted(() => ({ canDownload: vi.fn(), assign: vi.fn(), open: vi.fn() }));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/org/orgMediaApiClient", async (actual) => {
  const real = (await actual()) as typeof import("@/components/org/orgMediaApiClient");
  return { orgMediaApiClient: { ...real.orgMediaApiClient, canDownload: h.canDownload } };
});
vi.mock("@/lib/browser-navigation", () => ({ navigateTo: h.assign, openInNewTab: h.open }));

import { toast } from "sonner";
import { MediaDownloadButton } from "@/components/org/media-download-button";
import { MEDIA_VIEWER_COPY } from "@/components/org/media-library-copy";

const photo = { id: "asset-1", kind: "IMAGE" as const, ref: "orgs/o/a.jpg" };
const youtube = { id: "asset-2", kind: "VIDEO_EMBED" as const, ref: "dQw4w9WgXcQ" };
const HREF = "/api/org/org-1/media/asset-1/download";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const tap = () => fireEvent.click(screen.getByRole("link", { name: MEDIA_VIEWER_COPY.download }));

describe("MediaDownloadButton", () => {
  it("is a link to the download route, and navigates to it once HEAD says the file is there (spec A5)", async () => {
    h.canDownload.mockResolvedValue(undefined);
    render(<MediaDownloadButton orgId="org-1" asset={photo} />);
    expect(screen.getByRole("link", { name: MEDIA_VIEWER_COPY.download }).getAttribute("href")).toBe(HREF);
    // false: the anchor's own navigation is held until HEAD answers.
    expect(tap()).toBe(false);
    expect(h.assign).not.toHaveBeenCalled();
    await waitFor(() => expect(h.assign).toHaveBeenCalledWith(HREF));
    expect(h.canDownload).toHaveBeenCalledWith("org-1", "asset-1");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a double tap asks once", async () => {
    let resolve!: () => void;
    h.canDownload.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    render(<MediaDownloadButton orgId="org-1" asset={photo} />);
    tap();
    tap();
    resolve();
    await waitFor(() => expect(h.assign).toHaveBeenCalledTimes(1));
    expect(h.canDownload).toHaveBeenCalledTimes(1);
  });

  it("a retired item whose file was swept says so and does not navigate (Q10)", async () => {
    h.canDownload.mockRejectedValue(new ApiError("", 410));
    render(<MediaDownloadButton orgId="org-1" asset={photo} />);
    tap();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(MEDIA_VIEWER_COPY.fileGone));
    expect(h.assign).not.toHaveBeenCalled();
  });

  it("another shop's item reads as not in this library (spec A7)", async () => {
    h.canDownload.mockRejectedValue(new ApiError("", 404));
    render(<MediaDownloadButton orgId="org-1" asset={photo} />);
    tap();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(MEDIA_VIEWER_COPY.notInLibrary));
    expect(h.assign).not.toHaveBeenCalled();
  });

  it("a failed connection offers Try again, which asks again", async () => {
    h.canDownload.mockRejectedValueOnce(new ApiError("offline", 0)).mockResolvedValueOnce(undefined);
    render(<MediaDownloadButton orgId="org-1" asset={photo} />);
    tap();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [title, options] = vi.mocked(toast.error).mock.calls[0] as [string, { description: string; action: { label: string; onClick: () => void } }];
    expect(title).toBe(MEDIA_VIEWER_COPY.downloadFailed);
    expect(options.description).toBe(MEDIA_VIEWER_COPY.downloadFailedHint);
    expect(options.action.label).toBe(MEDIA_VIEWER_COPY.tryAgain);
    options.action.onClick();
    await waitFor(() => expect(h.assign).toHaveBeenCalledWith(HREF));
  });

  it("a YouTube link is a button that explains and offers Open on YouTube, never the route (spec A6)", async () => {
    render(<MediaDownloadButton orgId="org-1" asset={youtube} />);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: MEDIA_VIEWER_COPY.download }));
    expect(h.canDownload).not.toHaveBeenCalled();
    const [message, options] = vi.mocked(toast).mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
    expect(message).toBe(MEDIA_VIEWER_COPY.youtubeNoFile);
    expect(options.action.label).toBe(MEDIA_VIEWER_COPY.openOnYouTube);
    options.action.onClick();
    expect(h.open).toHaveBeenCalledWith("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});
