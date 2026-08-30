/**
 * The list must render the server's banners, not a copy it took once.
 *
 * The first version held `useState(banners)`, and `router.refresh()` preserves client
 * state by design — so a deleted banner stayed on screen and a toggled switch stayed
 * in its old position. Nothing failed; the screen just lied.
 */
import { describe, expect, it, vi } from "vitest";
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
