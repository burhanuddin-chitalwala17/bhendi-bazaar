/**
 * The list must render the server's banners, not a copy it took once.
 *
 * The first version held `useState(banners)`, and `router.refresh()` preserves client
 * state by design — so a deleted banner stayed on screen and a toggled switch stayed
 * in its old position. Nothing failed; the screen just lied.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import { BannerList } from "@/components/banners/BannerList";
import type { AdminBanner } from "@server/catalog/banner.types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const banner = (id: string, isActive = true): AdminBanner => ({
  id,
  title: `Banner ${id}`,
  eyebrow: null,
  description: null,
  imageUrl: null,
  imageAlt: null,
  order: 0,
  isActive,
  actions: [],
});

describe("BannerList", () => {
  it("drops a banner the server no longer returns", () => {
    const { rerender } = render(<BannerList banners={[banner("a"), banner("b")]} />);
    expect(screen.getByText("Banner b")).toBeInTheDocument();

    rerender(<BannerList banners={[banner("a")]} />); // what a refresh after DELETE sends
    expect(screen.queryByText("Banner b")).not.toBeInTheDocument();
  });

  it("follows the server's live/down state instead of its own copy", () => {
    const { rerender } = render(<BannerList banners={[banner("a", true)]} />);
    expect(screen.getByText("Live")).toBeInTheDocument();

    rerender(<BannerList banners={[banner("a", false)]} />);
    expect(screen.getByText("Down")).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("follows the server's order", () => {
    const { rerender } = render(<BannerList banners={[banner("a"), banner("b")]} />);
    const first = () => screen.getAllByRole("listitem")[0];
    expect(first()).toHaveTextContent("Banner a");

    rerender(<BannerList banners={[banner("b"), banner("a")]} />);
    expect(first()).toHaveTextContent("Banner b");
  });

  it("shows the empty state rather than an empty list", () => {
    render(<BannerList banners={[]} />);
    expect(screen.getByText("No banners yet")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});

/**
 * The in-flight window. A reorder is optimistic, and the first fix keyed that optimism
 * to a transition — but `router.refresh()` returns when the refresh is dispatched, not
 * when the new props land, so the transition settled early: the list snapped back to
 * the old order and the buttons re-armed while the write was still in the air. The
 * rerender-based tests above cannot see this; they never leave a request pending.
 */
describe("BannerList while a reorder is in flight", () => {
  function pendingFetch() {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await gate;
        return { ok: true, json: async () => ({ success: true }) } as Response;
      })
    );
    return { release: () => act(() => (release(), gate)) };
  }

  const order = () => screen.getAllByRole("listitem").map((li) => li.textContent);

  it("keeps the moved order while the server has not caught up", async () => {
    const { release } = pendingFetch();
    render(<BannerList banners={[banner("a"), banner("b")]} />);

    fireEvent.click(screen.getByLabelText("Move Banner a down"));
    // Request still open, props unchanged — the moved order must hold.
    await waitFor(() => expect(order()[0]).toContain("Banner b"));

    await release();
    expect(order()[0]).toContain("Banner b");
  });

  it("does not re-arm the buttons mid-flight", async () => {
    const { release } = pendingFetch();
    render(<BannerList banners={[banner("a"), banner("b")]} />);

    fireEvent.click(screen.getByLabelText("Move Banner a down"));
    await waitFor(() =>
      expect(screen.getByLabelText("Move Banner a up")).toBeDisabled()
    );
    await release();
  });

  it("returns to the server's order when the reorder is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: "Reorder must list every banner exactly once" }),
      }) as unknown as Response)
    );
    render(<BannerList banners={[banner("a"), banner("b")]} />);

    fireEvent.click(screen.getByLabelText("Move Banner a down"));
    await waitFor(() => expect(order()[0]).toContain("Banner a"));
  });
});
