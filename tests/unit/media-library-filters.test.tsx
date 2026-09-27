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
  DateRangeField: ({ onChange }: { onChange: (range: { from?: string; to?: string }) => void }) => (
    <button type="button" onClick={() => onChange({ from: "2026-09-01", to: "2026-09-27" })}>pick range</button>
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
