// The two ways into the viewer (viewer spec R2, A2; Q7): the tile's ⤢ control, and the side sheet's button.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MediaAssetDto } from "@server/catalog/media-library.types";

const h = vi.hoisted(() => ({ viewerProps: vi.fn(), detail: vi.fn(), refresh: vi.fn() }));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("@/components/org/orgMediaApiClient", async (actual) => {
  const real = (await actual()) as typeof import("@/components/org/orgMediaApiClient");
  return { orgMediaApiClient: { ...real.orgMediaApiClient, detail: h.detail } };
});
// The viewer itself has its own test; here only what the grid hands it matters.
vi.mock("@/components/org/LazyLibraryViewer", () => ({
  LazyLibraryViewer: (props: { index: number | null }) => {
    h.viewerProps(props);
    return props.index === null ? null : <div data-testid="viewer">{String(props.index)}</div>;
  },
}));
vi.mock("@/components/product/crop-dialog", () => ({ CropDialog: () => null }));
vi.mock("@/components/product/improve-dialog", () => ({ ImproveDialog: () => null }));
vi.mock("@/components/content/styled-shot-dialog", () => ({ StyledShotDialog: () => null }));
vi.mock("@/components/product/media-library-picker", () => ({ MediaLibraryPicker: () => null }));
vi.mock("@/components/subscriptions/locked-action", () => ({
  LockedAction: ({ children }: { children: React.ReactNode }) => children,
}));

import { MediaLibraryGrid } from "@/components/org/media-library-grid";
import { MediaLibraryTile } from "@/components/org/media-library-tile";
import { MEDIA_GRID_COPY, MEDIA_VIEWER_COPY } from "@/components/org/media-library-copy";

const base: MediaAssetDto = {
  id: "a0", kind: "IMAGE", ref: "/p0.jpg", width: 600, height: 1200, bytes: 2048, mimeType: "image/jpeg",
  source: "UPLOAD", state: "READY", uses: 0, derivedCount: 0, tags: [], createdAt: "2026-11-01T00:00:00Z",
  orgId: "org-1", retiredAt: null, retiredBy: null, retiredReason: null, poster: null, posterChosen: false,
  durationMs: null, renditions: [], failureReason: null,
};
const photo = (n: number): MediaAssetDto => ({ ...base, id: `a${n}`, ref: `/p${n}.jpg` });

beforeEach(() => {
  vi.clearAllMocks();
  h.detail.mockResolvedValue({ asset: photo(1), uses: [] });
});
afterEach(cleanup);

describe("the tile's full-screen control", () => {
  it("is a labelled control of its own, and opens the viewer rather than the sheet (R2, Q7)", () => {
    const onOpen = vi.fn();
    const onFullScreen = vi.fn();
    render(<MediaLibraryTile asset={photo(0)} onOpen={onOpen} onFullScreen={onFullScreen} />);
    fireEvent.click(screen.getByRole("button", { name: MEDIA_VIEWER_COPY.fullScreen }));
    expect(onFullScreen).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("keeps the use count in the top-right and moves a state badge below itself (Q7)", () => {
    render(
      <MediaLibraryTile
        asset={{ ...photo(0), kind: "VIDEO", state: "PROCESSING", uses: 2 }}
        onOpen={() => {}}
        onFullScreen={() => {}}
      />,
    );
    expect(screen.getByText(MEDIA_GRID_COPY.useCount(2)).className).toContain("right-1");
    const state = screen.getByText(MEDIA_GRID_COPY.stateProcessing);
    expect(state.className).toContain("left-1");
    // Below the 44px control, not under it.
    expect(state.className).toContain("top-11");
  });
});

describe("the library grid", () => {
  const initial = {
    assets: [photo(0), photo(1), photo(2)],
    pagination: { page: 1, limit: 3, total: 3, totalPages: 1 },
  };
  const grid = () => render(<MediaLibraryGrid orgId="org-1" initial={initial} query="" />);

  it("opens the viewer on the tile whose ⤢ was tapped (R2)", () => {
    grid();
    fireEvent.click(screen.getAllByRole("button", { name: MEDIA_VIEWER_COPY.fullScreen })[1]);
    expect(screen.getByTestId("viewer")).toHaveTextContent("1");
  });

  it("opens the viewer on the same item from the side sheet (spec A2)", () => {
    grid();
    fireEvent.click(screen.getAllByRole("button", { name: /^Photo/ })[2]);
    fireEvent.click(screen.getByRole("button", { name: MEDIA_VIEWER_COPY.viewFullImage }));
    expect(screen.getByTestId("viewer")).toHaveTextContent("2");
  });

  it("hands the viewer the grid's own list, in the grid's order (Q4)", () => {
    grid();
    fireEvent.click(screen.getAllByRole("button", { name: MEDIA_VIEWER_COPY.fullScreen })[0]);
    expect(h.viewerProps).toHaveBeenCalledWith(
      expect.objectContaining({ assets: initial.assets, total: 3, done: true }),
    );
  });
});
