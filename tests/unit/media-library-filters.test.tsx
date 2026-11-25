// The library's filters live in the URL and apply as picked, by client navigation rather than a
// page load (media-library spec R6): a change becomes a query string with blanks and defaults left
// out, and only the router moves — nothing submits.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/org/org-1/library",
}));

vi.mock("@/components/shared/forms/date-range-field", () => ({
  DateRangeField: ({ value, onChange }: { value: { from?: string; to?: string }; onChange: (range: { from?: string; to?: string }) => void }) => (
    <>
      <input type="hidden" name="from" value={value.from ?? ""} />
      <input type="hidden" name="to" value={value.to ?? ""} />
      <button type="button" onClick={() => onChange({ from: "2026-09-01", to: "2026-09-27" })}>pick range</button>
    </>
  ),
}));

const { MediaLibraryFilters, filterQueryFrom } = await import("@/components/org/media-library-filters");

const kinds = [{ value: "IMAGE", label: "Photos" }, { value: "VIDEO_EMBED", label: "Videos" }];
const sources = [{ value: "UPLOAD", label: "Uploaded" }];
const base = { usage: "all" as const, retired: false, page: 1 };

beforeEach(() => replace.mockClear());

describe("MediaLibraryFilters", () => {
  it("navigates on the client with the picked filters, leaving blanks and the default usage out", () => {
    render(<MediaLibraryFilters filters={base} range={{}} kinds={kinds} sources={sources} />);
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "IMAGE" } });
    expect(replace).toHaveBeenCalledWith("/org/org-1/library?kind=IMAGE", { scroll: false });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(replace).toHaveBeenLastCalledWith("/org/org-1/library?kind=IMAGE&retired=1", { scroll: false });
  });

  it("the shared fields write the same URL as before: tag and source join a range already picked (picker-filters D1)", () => {
    render(<MediaLibraryFilters filters={{ ...base, kind: "IMAGE" }} range={{ from: "2026-09-01" }} kinds={kinds} sources={sources} />);
    fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "PRODUCT" } });
    expect(replace).toHaveBeenLastCalledWith("/org/org-1/library?tag=PRODUCT&kind=IMAGE&from=2026-09-01", { scroll: false });
    fireEvent.change(screen.getByLabelText("Came from"), { target: { value: "UPLOAD" } });
    expect(replace).toHaveBeenLastCalledWith("/org/org-1/library?tag=PRODUCT&kind=IMAGE&source=UPLOAD&from=2026-09-01", { scroll: false });
    fireEvent.click(screen.getByText("pick range"));
    expect(replace).toHaveBeenLastCalledWith("/org/org-1/library?tag=PRODUCT&kind=IMAGE&source=UPLOAD&from=2026-09-01&to=2026-09-27", { scroll: false });
    expect(replace).toHaveBeenCalledTimes(3);
  });

  it("follows the URL when it moves underneath, so a stale range is never put back (picker-filters D1)", () => {
    const { rerender } = render(<MediaLibraryFilters filters={base} range={{ from: "2026-09-01", to: "2026-09-27" }} kinds={kinds} sources={sources} />);
    rerender(<MediaLibraryFilters filters={{ ...base, kind: "IMAGE" }} range={{}} kinds={kinds} sources={sources} />);
    expect((screen.getByLabelText("Kind") as HTMLSelectElement).value).toBe("IMAGE");
    fireEvent.change(screen.getByLabelText("Usage"), { target: { value: "used" } });
    expect(replace).toHaveBeenLastCalledWith("/org/org-1/library?kind=IMAGE&usage=used", { scroll: false });
  });

  it("clearing every filter navigates to the bare path", () => {
    render(<MediaLibraryFilters filters={{ ...base, kind: "IMAGE" }} range={{}} kinds={kinds} sources={sources} />);
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "" } });
    expect(replace).toHaveBeenLastCalledWith("/org/org-1/library", { scroll: false });
  });

  it("a picked range replaces the form's own two keys in the query", () => {
    render(<MediaLibraryFilters filters={base} range={{}} kinds={kinds} sources={sources} />);
    fireEvent.click(screen.getByText("pick range"));
    expect(replace).toHaveBeenLastCalledWith("/org/org-1/library?from=2026-09-01&to=2026-09-27", { scroll: false });
    const form = document.createElement("form");
    form.innerHTML = '<input name="from" value="2026-01-01"><input name="kind" value="IMAGE">';
    expect(filterQueryFrom(form, { to: "2026-09-27" })).toBe("kind=IMAGE&to=2026-09-27");
  });

  it("reads a form into a query: blanks and the default usage left out, everything else carried", () => {
    const form = document.createElement("form");
    form.innerHTML = '<input name="kind" value="IMAGE"><input name="usage" value="used"><input name="from" value="">';
    expect(filterQueryFrom(form)).toBe("kind=IMAGE&usage=used");
    const untouched = document.createElement("form");
    untouched.innerHTML = '<input name="kind" value=""><input name="usage" value="all">';
    expect(filterQueryFrom(untouched)).toBe("");
  });
});
