/**
 * The storefront hero's empty path. The TRD called this "the one most likely to
 * regress silently": with no active banners the hero must render nothing at all, not
 * an empty box, a bare rail, or a crash — the homepage is still a shop without it.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeHero } from "@/components/home/home-hero";
import type { HeroBannerContent } from "@/components/home/hero-banner";

const banner = (id: string): HeroBannerContent => ({
  id,
  title: `Banner ${id}`,
  actions: [{ label: "Shop", href: "/category/abayas", variant: "primary" }],
});

describe("HomeHero", () => {
  it("renders nothing when no banner is active", () => {
    const { container } = render(<HomeHero banners={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the banner it is given", () => {
    render(<HomeHero banners={[banner("a")]} />);
    expect(screen.getByText("Banner a")).toBeInTheDocument();
  });

  // One banner is not a carousel: no rail semantics, no dots, nothing to advance.
  it("adds carousel semantics only once there is more than one", () => {
    const { rerender } = render(<HomeHero banners={[banner("a")]} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();

    rerender(<HomeHero banners={[banner("a"), banner("b")]} />);
    expect(screen.getAllByRole("group")).toHaveLength(2);
    expect(screen.getByLabelText("Go to banner 2")).toBeInTheDocument();
  });
});
