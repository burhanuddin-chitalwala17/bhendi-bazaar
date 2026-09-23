/**
 * The storefront hero's empty path. The TRD called this "the one most likely to
 * regress silently": with no active banners the hero must render nothing at all, not
 * an empty box, a bare rail, or a crash — the homepage is still a shop without it.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeHero } from "@/components/home/home-hero";
import { HeroBanner } from "@/components/home/hero-banner";
import type { HeroBannerContent } from "@/components/home/hero-banner";

/** The reading scrim, by the gradient that makes it. */
const scrimIn = (root: HTMLElement) =>
  root.querySelector('[class*="from-scrim/85"]');

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

/**
 * Artwork on its own. Every word on a banner is optional, headline included, and a
 * banner with none is the picture — so the scrim that exists to make words legible
 * must not be there. On a phone it has no hover to hide behind, which is where a
 * permanently dimmed image was showing up.
 */
describe("HeroBanner with no words", () => {
  const image = { src: "/eid.webp", alt: "Ridas on a rail" };

  it("renders the picture with no scrim over it", () => {
    const { container } = render(
      <HeroBanner banner={{ id: "a", image }} />,
    );
    expect(container.querySelector("img")).toBeInTheDocument();
    expect(scrimIn(container)).toBeNull();
  });

  it("keeps the scrim as soon as there is something to read", () => {
    for (const words of [
      { title: "Eid picks" },
      { eyebrow: "The Abaya Edit" },
      { description: "New ridas, in store now" },
      { actions: [{ label: "Shop", href: "/category/abayas" }] },
    ]) {
      const { container, unmount } = render(
        <HeroBanner banner={{ id: "a", image, ...words }} />,
      );
      expect(scrimIn(container)).not.toBeNull();
      unmount();
    }
  });

  it("drops the headline rather than rendering an empty one", () => {
    const { container } = render(
      <HeroBanner banner={{ id: "a", image, eyebrow: "The Abaya Edit" }} />,
    );
    expect(container.querySelector("h2")).toBeNull();
    expect(screen.getByText("The Abaya Edit")).toBeInTheDocument();
  });
});
