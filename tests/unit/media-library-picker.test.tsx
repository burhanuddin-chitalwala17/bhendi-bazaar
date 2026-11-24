// The picker's own filters (picker-filters spec R1–R6): local state that builds the library query,
// starts the grid over on a change, keeps the gallery's ticks, and never moves the page underneath.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MediaAssetDto } from "@server/catalog/media-library.types";

const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/org/org-1/products/new",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
  default: ({ src }: { src: string }) => <img src={src} alt="" />,
}));

vi.mock("@/components/shared/forms/date-range-field", () => ({
  DateRangeField: ({ onChange }: { onChange: (range: { from?: string; to?: string }) => void }) => (
    <button type="button" onClick={() => onChange({ from: "2026-11-24", to: "2026-11-24" })}>pick today</button>
  ),
}));

const page = vi.fn();
vi.mock("@/components/org/orgMediaApiClient", () => ({ orgMediaApiClient: { page: (...args: unknown[]) => page(...args) } }));

const { MediaLibraryPicker } = await import("@/components/product/media-library-picker");

const photo = (id: string): MediaAssetDto =>
  ({ id, kind: "IMAGE", ref: `https://cdn.test/${id}.jpg`, source: "UPLOAD", state: "READY", tags: [], uses: 0 }) as unknown as MediaAssetDto;
const answer = (assets: MediaAssetDto[]) => ({ assets, pagination: { page: 1, totalPages: 1, total: assets.length, limit: 24 } });

function renderPicker(props: Partial<Parameters<typeof MediaLibraryPicker>[0]> = {}) {
  return render(
    <MediaLibraryPicker orgId="org-1" open onOpenChange={() => {}} taken={new Set()} onPick={() => {}} onUnpick={() => {}} {...props} />,
  );
}

const lastQuery = () => page.mock.calls.at(-1)?.[1] as string;

beforeEach(() => {
  page.mockReset();
  page.mockResolvedValue(answer([photo("a"), photo("b")]));
  Object.values(router).forEach((spy) => spy.mockClear());
});

describe("MediaLibraryPicker filters", () => {
  it("Tag Product and Usage Not used fetch only unused product photos (spec A1)", async () => {
    renderPicker();
    await waitFor(() => expect(lastQuery()).toBe("kind=IMAGE"));
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "PRODUCT" } });
    fireEvent.change(screen.getByLabelText("Usage"), { target: { value: "unused" } });
    await waitFor(() => expect(lastQuery()).toBe("kind=IMAGE&tag=PRODUCT&usage=unused"));
    expect(screen.getByRole("button", { name: "Filters · 2" })).toBeTruthy();
  });

  it("offers no Tag filter on the Videos tab, and does not count a tag chosen on Photos (spec A2)", async () => {
    renderPicker();
    fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "REFERENCE" } });
    fireEvent.click(screen.getByRole("button", { name: /Videos/ }));
    expect(screen.queryByLabelText("Tag")).toBeNull();
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
    await waitFor(() => expect(lastQuery()).toBe("kind=VIDEO"));
  });

  it("offers only the sources a tab can hold, and no Came from on YouTube (spec R2, Q7)", () => {
    renderPicker();
    const options = () => Array.from((screen.getByLabelText("Came from") as HTMLSelectElement).options).map((option) => option.text);
    expect(options()).toEqual(["Anywhere", "Uploaded", "Cropped or made"]);
    fireEvent.click(screen.getByRole("button", { name: /YouTube/ }));
    expect(screen.queryByLabelText("Came from")).toBeNull();
  });

  it("filtering never touches the router, so the page's URL is unchanged (spec A3)", async () => {
    renderPicker();
    fireEvent.change(screen.getByLabelText("Came from"), { target: { value: "DERIVED" } });
    fireEvent.click(screen.getByText("pick today"));
    await waitFor(() => expect(lastQuery()).toBe("kind=IMAGE&source=DERIVED&from=2026-11-24&to=2026-11-24"));
    for (const spy of Object.values(router)) expect(spy).not.toHaveBeenCalled();
  });

  it("a photo already in the gallery stays ticked after a filter change (spec A4)", async () => {
    renderPicker({ taken: new Set(["https://cdn.test/a.jpg"]) });
    await waitFor(() => expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1));
    page.mockResolvedValue(answer([photo("a")]));
    fireEvent.change(screen.getByLabelText("Usage"), { target: { value: "used" } });
    await waitFor(() => expect(lastQuery()).toBe("kind=IMAGE&usage=used"));
    await waitFor(() => expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1));
  });

  it("filters with no matches say so and clear in one tap (spec A5)", async () => {
    renderPicker();
    await waitFor(() => expect(lastQuery()).toBe("kind=IMAGE"));
    page.mockResolvedValue(answer([]));
    fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "REFERENCE" } });
    expect(await screen.findByText("Nothing matches these filters.")).toBeTruthy();
    expect(screen.queryByText("No photos in your library yet.")).toBeNull();
    page.mockResolvedValue(answer([photo("a")]));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Clear filters" })));
    await waitFor(() => expect(lastQuery()).toBe("kind=IMAGE"));
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
  });

  it("an empty library keeps its own line and offers no Filters button (ux Empty (library))", async () => {
    page.mockResolvedValue(answer([]));
    renderPicker();
    expect(await screen.findByText("No photos in your library yet.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Filters/ })).toBeNull());
  });

  it("the poster picker, a single Photos tab, still shows the filters (spec A6)", async () => {
    renderPicker({ kinds: ["IMAGE"] });
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
    expect(screen.getByLabelText("Tag")).toBeTruthy();
  });

  it("all three callers render the one picker, so each gets the filters with no new prop (spec A6)", () => {
    const callers = [
      "src/components/product/product-media-manager.tsx",
      "src/components/org/media-library-grid.tsx",
      "src/components/content/styled-shot-dialog.tsx",
    ];
    for (const file of callers) {
      expect(readFileSync(resolve(__dirname, "../..", file), "utf8"), file).toMatch(/<MediaLibraryPicker\b/);
    }
  });
});
