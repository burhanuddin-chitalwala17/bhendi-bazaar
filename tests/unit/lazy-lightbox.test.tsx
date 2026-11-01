/** The lightbox costs nothing until opened, and still opens (GTM B12). */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Resolves the dynamic import at once, so the test sees what an opened lightbox mounts.
vi.mock("next/dynamic", () => ({
  default: () => (props: { alt: string }) => <div role="dialog" aria-label={props.alt} />,
}));

const { LazyImageLightbox } = await import("@/components/shared/LazyImageLightbox");
const props = { images: ["/a.jpg"], alt: "Rida", activeIndex: 0, onOpenChange: () => {}, onIndexChange: () => {} };

describe("LazyImageLightbox", () => {
  it("mounts nothing while closed", () => {
    const { container } = render(<LazyImageLightbox {...props} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mounts the lightbox when opened", () => {
    render(<LazyImageLightbox {...props} open />);
    expect(screen.getByRole("dialog", { name: "Rida" })).toBeInTheDocument();
  });
});
