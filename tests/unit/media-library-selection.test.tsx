// Selection mode on the org Library (bulk-actions spec R1, R2; ux.md journeys J1–J3): ticks instead
// of the sheet, the bar's count, and each action wired to its client with the outcome said in a toast.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { MediaAssetDto } from "@server/catalog/media-library.types";

const h = vi.hoisted(() => ({
  detail: vi.fn(),
  retireMany: vi.fn(),
  setTagMany: vi.fn(),
  refresh: vi.fn(),
  download: vi.fn(),
  cancel: vi.fn(),
  progress: null as { done: number; total: number } | null,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), h.toast) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("@/components/org/orgMediaApiClient", async (actual) => {
  const real = (await actual()) as typeof import("@/components/org/orgMediaApiClient");
  return {
    orgMediaApiClient: { ...real.orgMediaApiClient, detail: h.detail, retireMany: h.retireMany, setTagMany: h.setTagMany },
  };
});
vi.mock("@/components/org/useLibraryZip", () => ({
  useLibraryZip: () => ({ download: h.download, cancel: h.cancel, progress: h.progress }),
}));
vi.mock("@/components/org/LazyLibraryViewer", () => ({ LazyLibraryViewer: () => null }));
vi.mock("@/components/product/crop-dialog", () => ({ CropDialog: () => null }));
vi.mock("@/components/product/improve-dialog", () => ({ ImproveDialog: () => null }));
vi.mock("@/components/content/styled-shot-dialog", () => ({ StyledShotDialog: () => null }));
vi.mock("@/components/product/media-library-picker", () => ({ MediaLibraryPicker: () => null }));
vi.mock("@/components/subscriptions/locked-action", () => ({
  LockedAction: ({ children }: { children: React.ReactNode }) => children,
}));

import { MediaLibraryGrid } from "@/components/org/media-library-grid";
import { MEDIA_BULK_COPY as C, MEDIA_GRID_COPY, MEDIA_VIEWER_COPY } from "@/components/org/media-library-copy";

const base: MediaAssetDto = {
  id: "a0", kind: "IMAGE", ref: "/p0.jpg", width: 600, height: 1200, bytes: 2048, mimeType: "image/jpeg",
  source: "UPLOAD", state: "READY", uses: 0, derivedCount: 0, tags: [], createdAt: "2026-11-01T00:00:00Z",
  orgId: "org-1", retiredAt: null, retiredBy: null, retiredReason: null, poster: null, posterChosen: false,
  durationMs: null, renditions: [], failureReason: null,
};
const item = (id: string, extra: Partial<MediaAssetDto> = {}): MediaAssetDto => ({ ...base, id, ref: `/${id}.jpg`, ...extra });
const page = (assets: MediaAssetDto[]) => ({
  assets,
  pagination: { page: 1, limit: assets.length, total: assets.length, totalPages: 1 },
});

const tiles = () => screen.getAllByRole("button", { name: /^(Photo|Video)/ });
const grid = (assets: MediaAssetDto[], query = "") =>
  render(<MediaLibraryGrid key={query} orgId="org-1" orgCode="BBZ01" initial={page(assets)} query={query} />);
const bar = () => screen.getByRole("region", { name: "Selection" });

beforeEach(() => {
  vi.clearAllMocks();
  h.progress = null;
  h.detail.mockResolvedValue({ asset: base, uses: [] });
});
afterEach(cleanup);

describe("selection mode (spec R1, R2)", () => {
  it("a tap ticks a tile instead of opening the sheet; Done clears every tick (spec A1)", () => {
    grid([item("a"), item("b"), item("c")]);
    fireEvent.click(screen.getByRole("button", { name: C.select }));
    expect(within(bar()).getByText(C.none)).toBeTruthy();

    fireEvent.click(tiles()[0]);
    fireEvent.click(tiles()[2]);
    expect(tiles().map((tile) => tile.getAttribute("aria-pressed"))).toEqual(["true", "false", "true"]);
    expect(within(bar()).getByText(C.count(2))).toBeTruthy();
    expect(h.detail).not.toHaveBeenCalled();
    // The ⤢ control is hidden in the mode; the tick takes its corner.
    expect(screen.queryByRole("button", { name: MEDIA_VIEWER_COPY.fullScreen })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: C.done }));
    expect(screen.queryByRole("region", { name: "Selection" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: C.select }));
    expect(within(bar()).getByText(C.none)).toBeTruthy();
  });

  it("Select all ticks every loaded tile and the bar shows the count (spec A2)", () => {
    grid([item("a"), item("b"), item("c")]);
    fireEvent.click(screen.getByRole("button", { name: C.select }));
    fireEvent.click(screen.getByRole("button", { name: C.selectAll(3) }));
    expect(within(bar()).getByText(C.count(3))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: C.clear }));
    expect(within(bar()).getByText(C.none)).toBeTruthy();
  });

  it("a filter change leaves the mode and clears the selection (Q12)", () => {
    const { rerender } = grid([item("a")], "kind=IMAGE");
    fireEvent.click(screen.getByRole("button", { name: C.select }));
    fireEvent.click(tiles()[0]);
    rerender(<MediaLibraryGrid key="kind=VIDEO" orgId="org-1" orgCode="BBZ01" initial={page([item("a")])} query="kind=VIDEO" />);
    expect(screen.queryByRole("region", { name: "Selection" })).toBeNull();
  });

  it("outside the mode a tile still opens its sheet, and Select is hidden on an empty library", () => {
    grid([item("a")]);
    fireEvent.click(tiles()[0]);
    expect(h.detail).toHaveBeenCalled();
    cleanup();
    grid([]);
    expect(screen.queryByRole("button", { name: C.select })).toBeNull();
  });

  it("an action with nothing selected says so", () => {
    grid([item("a")]);
    fireEvent.click(screen.getByRole("button", { name: C.select }));
    fireEvent.click(within(bar()).getByRole("button", { name: C.retire }));
    expect(h.toast.error).toHaveBeenCalledWith(C.nothingSelected, expect.anything());
  });
});

describe("the bar's actions", () => {
  const selectAll = (n: number) => {
    fireEvent.click(screen.getByRole("button", { name: C.select }));
    fireEvent.click(screen.getByRole("button", { name: C.selectAll(n) }));
  };

  it("Download zips the selection and says how many links were left out (spec A3)", async () => {
    const photos = Array.from({ length: 12 }, (_, i) => item(`p${i}`));
    h.download.mockResolvedValue({ kind: "saved", saved: 12, total: 12, failedIds: [], links: 1, deleted: 0, gone: 0 });
    grid([...photos, item("yt", { kind: "VIDEO_EMBED" })]);
    selectAll(13);
    await act(async () => fireEvent.click(within(bar()).getByRole("button", { name: C.download })));
    expect(h.download).toHaveBeenCalledWith([...photos.map((p) => p.id), "yt"]);
    expect(h.toast.success).toHaveBeenCalledWith(C.zipDone(12), expect.objectContaining({ description: C.zipLinks(1) }));
  });

  it("a partial zip offers to fetch only the failed ones again (Q13)", async () => {
    h.download.mockResolvedValue({ kind: "saved", saved: 1, total: 2, failedIds: ["b"], links: 0, deleted: 0, gone: 0 });
    grid([item("a"), item("b")]);
    selectAll(2);
    await act(async () => fireEvent.click(within(bar()).getByRole("button", { name: C.download })));
    const options = h.toast.warning.mock.calls[0][1];
    expect(options.action.label).toBe(C.zipRetry(1));
    await act(async () => options.action.onClick());
    expect(h.download).toHaveBeenLastCalledWith(["b"]);
  });

  it("while the zip builds, the bar shows progress and Cancel", () => {
    h.progress = { done: 4, total: 12 };
    grid([item("a")]);
    fireEvent.click(screen.getByRole("button", { name: C.select }));
    expect(within(bar()).getByText(C.zipProgress(4, 12))).toBeTruthy();
    fireEvent.click(within(bar()).getByRole("button", { name: C.cancel }));
    expect(h.cancel).toHaveBeenCalled();
    expect(within(bar()).queryByRole("button", { name: C.retire })).toBeNull();
  });

  it("Retire of 5 with 2 used confirms 3, retires them, and re-reads the grid (spec A4)", async () => {
    const assets = [item("a"), item("b"), item("c"), item("d", { uses: 1 }), item("e", { uses: 2 })];
    h.retireMany.mockResolvedValue({ retired: ["a", "b", "c"], inUse: [], alreadyRetired: [], notFound: [] });
    grid(assets);
    selectAll(5);
    fireEvent.click(within(bar()).getByRole("button", { name: C.retire }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(C.retireTitle(3))).toBeTruthy();
    expect(within(dialog).getByText(C.retireSomeUsed(2))).toBeTruthy();

    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: C.retireConfirm(3) })));
    expect(h.retireMany).toHaveBeenCalledWith("org-1", ["a", "b", "c"]);
    expect(h.toast.success).toHaveBeenCalledWith(C.retireDone(3), expect.anything());
    expect(h.refresh).toHaveBeenCalled();
    // The 3 leave the grid; the 2 in use stay ticked.
    expect(tiles()).toHaveLength(2);
    expect(within(bar()).getByText(C.count(2))).toBeTruthy();
  });

  it("a failed retire keeps the dialog open with the error under the button", async () => {
    h.retireMany.mockRejectedValue(new Error("offline"));
    grid([item("a")]);
    selectAll(1);
    fireEvent.click(within(bar()).getByRole("button", { name: C.retire }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: C.retireConfirm(1) })));
    expect(within(screen.getByRole("dialog")).getByText(C.unreachable)).toBeTruthy();
  });

  it("more than 100 go in batches; a later batch failing still says what landed (Q10)", async () => {
    const assets = Array.from({ length: 101 }, (_, i) => item(`r${i}`));
    h.retireMany
      .mockResolvedValueOnce({ retired: assets.slice(0, 100).map((a) => a.id), inUse: [], alreadyRetired: [], notFound: [] })
      .mockRejectedValueOnce(new Error("offline"));
    grid(assets);
    selectAll(101);
    fireEvent.click(within(bar()).getByRole("button", { name: C.retire }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: C.retireConfirm(101) })));
    expect(h.retireMany.mock.calls.map((call) => call[1].length)).toEqual([100, 1]);
    expect(h.toast.success).toHaveBeenCalledWith(C.retireDone(100), expect.anything());
    expect(h.toast.error).toHaveBeenCalledWith(C.unreachableShort);
    expect(tiles()).toHaveLength(1);
  });

  it("Retire with every item in use opens no dialog and says why", () => {
    grid([item("a", { uses: 1 })]);
    selectAll(1);
    fireEvent.click(within(bar()).getByRole("button", { name: C.retire }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(h.toast.error).toHaveBeenCalledWith(C.retireAllUsed, expect.objectContaining({ description: C.retireAllUsedHint(1) }));
  });

  it("Tag of 4 photos and 1 video adds the tag to the 4 and counts the video (spec A5, Q6)", async () => {
    const photos = ["a", "b", "c", "d"].map((id) => item(id));
    h.setTagMany.mockResolvedValue({ changed: ["a", "b", "c", "d"], notPhoto: [], retired: [], notFound: [] });
    grid([...photos, item("v", { kind: "VIDEO" })]);
    selectAll(5);
    fireEvent.click(within(bar()).getByRole("button", { name: C.tag }));
    // Named on both surfaces: the sheet's heading on a phone, the popover's label from md.
    const sheet = screen.getByRole("dialog", { name: C.tagTitle(4) });
    expect(within(sheet).getByText(C.tagNonPhotos(1))).toBeTruthy();

    const reference = within(sheet).getByRole("group", { name: MEDIA_GRID_COPY.tagLabel.REFERENCE });
    await act(async () => fireEvent.click(within(reference).getByRole("button", { name: C.tagAdd })));
    expect(h.setTagMany).toHaveBeenCalledWith("org-1", ["a", "b", "c", "d"], "REFERENCE", true);
    expect(h.toast.success).toHaveBeenCalledWith(
      C.tagAdded(4, MEDIA_GRID_COPY.tagLabel.REFERENCE),
      expect.objectContaining({ description: C.tagVideosLeftOut(1) }),
    );
    expect(h.refresh).toHaveBeenCalled();
  });

  it("Tag with only videos opens nothing and says only photos take tags", () => {
    grid([item("v", { kind: "VIDEO" })]);
    selectAll(1);
    fireEvent.click(within(bar()).getByRole("button", { name: C.tag }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(h.toast.error).toHaveBeenCalledWith(C.tagNoPhotos, expect.anything());
  });
});
