/**
 * The page grammar's shared parts (design-system page-grammar): the failure modes each one exists
 * to prevent — a server page that cannot offer a way forward, a second h1, a sort that forgets
 * the URL, a selection bar over nothing, a "0" tab count.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";

let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/products",
  useSearchParams: () => search,
}));

import { EmptyState } from "@/components/shared/states/EmptyState";
import { ResourceList, type ResourceColumn } from "@/components/shared/resource-list";
import { SelectionBar } from "@/components/shared/selection-bar";
import { PageTabs } from "@/components/shared/page-tabs";

type Row = { id: string; name: string; price: number };
const rows: Row[] = [
  { id: "a", name: "Zarina Rida", price: 2450 },
  { id: "b", name: "Noor Abaya", price: 3200 },
];
const columns: ResourceColumn<Row>[] = [
  { key: "name", label: "Product", cell: (r) => r.name, phone: "title" },
  { key: "price", label: "Price", cell: (r) => r.price, sortable: true, phone: "meta" },
];

describe("EmptyState", () => {
  it("gives a server page a way forward: an href renders a link", () => {
    render(<EmptyState title="No orders yet" description="…" action={{ label: "Copy shop link", href: "/org/1/shop" }} />);
    expect(screen.getByRole("link", { name: "Copy shop link" }).getAttribute("href")).toBe("/org/1/shop");
  });
});

describe("one h1 per page", () => {
  it("no SectionHeader is asked to be the page title — that is PageHeader", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((e) => {
        const p = join(dir, e);
        return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(e) ? [p] : [];
      });
    const offenders = files("src").filter((f) => /<SectionHeader\b[^>]*\bas="h1"/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("ResourceList sort lives in the URL", () => {
  it("marks the sorted header from the URL and links to the reverse, back at page one", () => {
    search = new URLSearchParams("sortBy=price&sortOrder=asc&page=3");
    render(<ResourceList label="Products" rows={rows} rowKey={(r) => r.id} columns={columns} />);
    const header = screen.getByRole("columnheader", { name: /Price/ });
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    const href = within(header).getByRole("link").getAttribute("href")!;
    const next = new URLSearchParams(href.split("?")[1]);
    expect(next.get("sortOrder")).toBe("desc");
    expect(next.has("page")).toBe(false);
  });

  it("an unsorted sortable header says so, and starts ascending", () => {
    search = new URLSearchParams();
    render(<ResourceList label="Products" rows={rows} rowKey={(r) => r.id} columns={columns} />);
    const header = screen.getByRole("columnheader", { name: /Price/ });
    expect(header.getAttribute("aria-sort")).toBe("none");
    expect(within(header).getByRole("link").getAttribute("href")).toContain("sortOrder=asc");
  });
});

describe("SelectionBar", () => {
  it("is absent when nothing is selected", () => {
    const { container } = render(<SelectionBar count={0} actions={[{ label: "Archive", onClick: () => {} }]} onClear={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows three actions and moves the rest behind More", () => {
    const act = (label: string) => ({ label, onClick: () => {} });
    render(<SelectionBar count={2} actions={["Edit price", "Edit stock", "Archive", "Delete"].map(act)} onClear={() => {}} />);
    expect(screen.getByText("2 selected")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();
  });

  it("caps its width from md only where a screen asks, so the products console's six controls are not squeezed", () => {
    const act = (label: string) => ({ label, onClick: () => {} });
    const props = {
      count: 2,
      selectAll: { label: "Select all 105", onClick: () => {} },
      actions: ["Edit price", "Edit stock", "Archive", "Delete"].map(act),
      onClear: () => {},
    };
    const panel = () => screen.getByRole("region", { name: "Selection" }).firstElementChild!.className;
    const { rerender } = render(<SelectionBar {...props} />);
    expect(panel()).not.toContain("md:max-w-md");
    rerender(<SelectionBar {...props} width="narrow" />);
    expect(panel()).toContain("md:max-w-md");
  });

  it("stays with a hint when a screen's selection mode is on and nothing is picked yet", () => {
    render(<SelectionBar count={0} hint="Tap rows to select them" actions={[{ label: "Archive", onClick: () => {} }]} onClear={() => {}} />);
    expect(screen.getByText("Tap rows to select them")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
  });

  it("while busy, shows progress and only Cancel; the actions wait", () => {
    const cancel = vi.fn();
    render(
      <SelectionBar
        count={3}
        busy={{ label: "Working 1 of 3", done: 1, total: 3, cancel: { label: "Cancel", onClick: cancel } }}
        actions={[{ label: "Archive", onClick: () => {} }]}
        onClear={() => {}}
      />,
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalled();
  });
});

describe("PageTabs", () => {
  it("marks the current tab and hides a zero count", () => {
    render(
      <PageTabs
        label="Order status"
        current="pack"
        tabs={[
          { key: "pack", label: "To pack", href: "?tab=pack", count: 4 },
          { key: "done", label: "Done", href: "?tab=done", count: 0 },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "To pack 4" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Done" }).textContent).toBe("Done");
  });
});
