// The Library's full-screen viewer (viewer spec R1, R3–R6; trd D8, D9; ux viewer state matrix).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { MediaAssetDto } from "@server/catalog/media-library.types";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/product/video-player", () => ({
  GALLERY_SLIDE_SIZES: "100vw",
  VideoPlayer: () => <div data-testid="video-player" />,
}));
vi.mock("@/components/product/youtube-embed", () => ({
  YouTubeEmbed: ({ ref_ }: { ref_: string }) => <div data-testid="youtube-embed">{ref_}</div>,
}));
vi.mock("@/components/product/youtube-poster", () => ({ YouTubePoster: () => <div data-testid="youtube-poster" /> }));

import { toast } from "sonner";
import { LibraryViewer } from "@/components/org/library-viewer";
import { MEDIA_VIEWER_COPY } from "@/components/org/media-library-copy";

const base: MediaAssetDto = {
  id: "a0", kind: "IMAGE", ref: "/p0.jpg", width: 600, height: 1200, bytes: 1, mimeType: "image/jpeg",
  source: "UPLOAD", state: "READY", uses: 0, derivedCount: 0, tags: [], createdAt: "2026-11-01T00:00:00Z",
  orgId: "org-1", retiredAt: null, retiredBy: null, retiredReason: null, poster: null, posterChosen: false,
  durationMs: null, renditions: [], failureReason: null,
};
const photo = (n: number): MediaAssetDto => ({ ...base, id: `a${n}`, ref: `/p${n}.jpg` });
const video: MediaAssetDto = {
  ...base, id: "v1", kind: "VIDEO", ref: "orgs/o/v.mp4", poster: "/poster.jpg", mimeType: "video/mp4",
  renditions: [{ key: "720", url: "/v720.mp4", width: 1280, height: 720 } as never],
};
const youtube: MediaAssetDto = { ...base, id: "y1", kind: "VIDEO_EMBED", ref: "dQw4w9WgXcQ", source: "EMBED" };

const h = { onMore: vi.fn(), onClose: vi.fn(), onDetails: vi.fn() };

function Harness({ assets, start = 0, done = true, total }: { assets: MediaAssetDto[]; start?: number; done?: boolean; total?: number }) {
  const [index, setIndex] = useState(start);
  return (
    <LibraryViewer
      orgId="org-1"
      assets={assets}
      total={total ?? assets.length}
      index={index}
      onIndexChange={setIndex}
      onMore={h.onMore}
      done={done}
      loading={false}
      onClose={h.onClose}
      onDetails={h.onDetails}
    />
  );
}

const scrolled = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled(this.getAttribute("aria-label"));
  };
});
afterEach(cleanup);

const counter = (n: number, total: number) => screen.getByText(MEDIA_VIEWER_COPY.counter(n, total));
const key = (k: string) => fireEvent.keyDown(window, { key: k });

describe("LibraryViewer", () => {
  it("opens on the item it was given, whole, with the counter (spec A1)", () => {
    render(<Harness assets={[photo(0), photo(1), photo(2)]} start={1} total={48} />);
    expect(counter(2, 48)).toBeInTheDocument();
    const current = screen.getByRole("img", { name: MEDIA_VIEWER_COPY.slideAlt(2, 48) });
    expect(current.getAttribute("src")).toContain(encodeURIComponent("/p1.jpg"));
    expect(current.className).toContain("object-contain");
  });

  it("arrow keys and the ‹ › buttons move through the grid's order (spec A3)", () => {
    render(<Harness assets={[photo(0), photo(1), photo(2)]} />);
    key("ArrowRight");
    expect(counter(2, 3)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: MEDIA_VIEWER_COPY.next }));
    expect(counter(3, 3)).toBeInTheDocument();
    key("ArrowLeft");
    fireEvent.click(screen.getByRole("button", { name: MEDIA_VIEWER_COPY.previous }));
    expect(counter(1, 3)).toBeInTheDocument();
  });

  it("asks for the next page two before the end, so swiping never stops (spec A3)", () => {
    render(<Harness assets={[photo(0), photo(1), photo(2), photo(3)]} done={false} total={30} />);
    key("ArrowRight");
    expect(h.onMore).not.toHaveBeenCalled();
    key("ArrowRight");
    expect(h.onMore).toHaveBeenCalled();
  });

  it("asks for nothing more once the list is done", () => {
    render(<Harness assets={[photo(0), photo(1), photo(2)]} start={2} done />);
    expect(h.onMore).not.toHaveBeenCalled();
  });

  it("› on the last item says so and stays (ux Last item)", () => {
    render(<Harness assets={[photo(0), photo(1)]} start={1} done />);
    key("ArrowRight");
    expect(toast).toHaveBeenCalledWith(MEDIA_VIEWER_COPY.lastOne);
    expect(counter(2, 2)).toBeInTheDocument();
  });

  it("a hosted video plays in the viewer and stops when it stops being current (spec A4)", () => {
    render(<Harness assets={[video, photo(1)]} />);
    expect(screen.getByTestId("video-player")).toBeInTheDocument();
    // Unmounted, not merely paused: a slide out of view holds no video element at all (trd D8).
    key("ArrowRight");
    expect(screen.queryByTestId("video-player")).toBeNull();
  });

  it("a YouTube link plays only while it is the current slide (spec A4; trd D8)", () => {
    render(<Harness assets={[photo(0), youtube]} />);
    expect(screen.queryByTestId("youtube-embed")).toBeNull();
    key("ArrowRight");
    expect(screen.getByTestId("youtube-embed")).toHaveTextContent("dQw4w9WgXcQ");
  });

  it("Download on a YouTube link explains why and offers Open on YouTube, not a link (spec A6)", () => {
    render(<Harness assets={[youtube]} />);
    expect(screen.queryByRole("link", { name: MEDIA_VIEWER_COPY.download })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: MEDIA_VIEWER_COPY.download }));
    expect(toast).toHaveBeenCalledWith(
      MEDIA_VIEWER_COPY.youtubeNoFile,
      expect.objectContaining({ action: expect.objectContaining({ label: MEDIA_VIEWER_COPY.openOnYouTube }) }),
    );
  });

  it("offers Download as a link to the route for a photo (spec A5)", () => {
    render(<Harness assets={[photo(0)]} />);
    expect(screen.getByRole("link", { name: MEDIA_VIEWER_COPY.download }).getAttribute("href")).toBe(
      "/api/org/org-1/media/a0/download",
    );
  });

  it("a processing video says it is still processing (ux Processing video)", () => {
    render(<Harness assets={[{ ...video, state: "PROCESSING", renditions: [] }]} />);
    expect(screen.getByText(MEDIA_VIEWER_COPY.processingTitle)).toBeInTheDocument();
    expect(screen.getByText(MEDIA_VIEWER_COPY.processingHint)).toBeInTheDocument();
    expect(screen.queryByTestId("video-player")).toBeNull();
  });

  it("a failed video says why, and Download is still offered (ux Terminal error)", () => {
    render(<Harness assets={[{ ...video, state: "FAILED", renditions: [], failureReason: "Too long" }]} />);
    expect(screen.getByText(MEDIA_VIEWER_COPY.failedVideo("Too long"))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: MEDIA_VIEWER_COPY.download })).toBeInTheDocument();
  });

  it("a picture that fails to load shows the panel, and Try again asks again (ux Retryable error)", () => {
    render(<Harness assets={[photo(0)]} />);
    fireEvent.error(screen.getByRole("img", { name: MEDIA_VIEWER_COPY.slideAlt(1, 1) }));
    expect(screen.getByText(MEDIA_VIEWER_COPY.imageFailed)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: MEDIA_VIEWER_COPY.tryAgain }));
    expect(screen.queryByText(MEDIA_VIEWER_COPY.imageFailed)).toBeNull();
    expect(screen.getByRole("img", { name: MEDIA_VIEWER_COPY.slideAlt(1, 1) })).toBeInTheDocument();
  });

  it("a thumbnail in the strip jumps to its item", () => {
    render(<Harness assets={[photo(0), photo(1), photo(2)]} />);
    fireEvent.click(screen.getByRole("button", { name: MEDIA_VIEWER_COPY.thumbnail(3) }));
    expect(counter(3, 3)).toBeInTheDocument();
  });

  it("shows the tile's thumbnail enlarged until the full picture arrives (ux Loading)", async () => {
    render(<Harness assets={[photo(0)]} />);
    expect(screen.getByTestId("slide-placeholder")).toBeInTheDocument();
    // next/image reports a load after the image decodes, a tick later.
    fireEvent.load(screen.getByRole("img", { name: MEDIA_VIEWER_COPY.slideAlt(1, 1) }));
    await waitFor(() => expect(screen.queryByTestId("slide-placeholder")).toBeNull());
  });

  it("the strip follows the current item (ux J1)", () => {
    render(<Harness assets={[photo(0), photo(1), photo(2)]} />);
    key("ArrowRight");
    expect(scrolled).toHaveBeenLastCalledWith(MEDIA_VIEWER_COPY.thumbnail(2));
  });

  it("closes rather than sit empty when the list shrinks under it", () => {
    render(<Harness assets={[photo(0)]} start={3} />);
    expect(h.onClose).toHaveBeenCalled();
  });

  it("✕ closes and ⓘ hands the current item to the details sheet", () => {
    render(<Harness assets={[photo(0), photo(1)]} start={1} />);
    fireEvent.click(screen.getByRole("button", { name: MEDIA_VIEWER_COPY.details }));
    expect(h.onDetails).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
    fireEvent.click(screen.getByRole("button", { name: MEDIA_VIEWER_COPY.close }));
    expect(h.onClose).toHaveBeenCalled();
  });
});
