/**
 * The one renderer (image-slots trd D6): a phone downloads the phone file and a tablet up the
 * desktop one, each from the optimizer at its own `sizes`; fit, position and fill differ per form
 * factor. A wrong media query or a swapped source still shows a picture — just the wrong file.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResponsiveImage } from "@/components/shared/responsive-image";
import type { ResponsiveImageDto } from "@server/catalog/image-framing";

const image: ResponsiveImageDto = {
  alt: "Eid edit",
  phone: { src: "/phone.webp", fit: "contain", position: { x: 0.25, y: 0.5 }, fill: "#102030" },
  desktop: { src: "/desktop.webp", fit: "crop", position: { x: 0.5, y: 1 }, fill: null },
};
const sizes = { phone: "100vw", desktop: "(min-width: 1024px) 72rem, 100vw" };

describe("ResponsiveImage", () => {
  it("serves the desktop file from md: and the phone file below it, both through the optimizer", () => {
    const { container } = render(<ResponsiveImage image={image} sizes={sizes} />);
    const source = container.querySelector("picture > source")!;
    const img = container.querySelector("picture > img")!;
    expect(source.getAttribute("media")).toBe("(min-width: 768px)");
    expect(source.getAttribute("srcset")).toContain("desktop.webp");
    expect(source.getAttribute("srcset")).toContain("/_next/image");
    expect(source.getAttribute("sizes")).toBe(sizes.desktop);
    expect(img.getAttribute("srcset")).toContain("phone.webp");
    expect(img.getAttribute("srcset")).not.toContain("desktop.webp");
    expect(img.getAttribute("sizes")).toBe(sizes.phone);
    expect(img.getAttribute("alt")).toBe("Eid edit");
  });

  it("fits the phone picture on its fill colour and crops the desktop one at its position", () => {
    const { container } = render(<ResponsiveImage image={image} sizes={sizes} />);
    const img = container.querySelector("img")!;
    expect(img.className).toContain("object-contain");
    expect(img.className).toContain("md:object-cover");
    const style = img.getAttribute("style") ?? "";
    expect(style).toContain("--slot-fill-phone: #102030");
    expect(style).toContain("--slot-fill-desktop: transparent");
    expect(style).toContain("--slot-pos-phone: 25% 50%");
    expect(style).toContain("--slot-pos-desktop: 50% 100%");
  });

  it("loads the hero eagerly at high priority, and anything else lazily", () => {
    const eager = render(<ResponsiveImage image={image} sizes={sizes} preload />).container.querySelector("img")!;
    expect(eager.getAttribute("loading")).toBe("eager");
    expect(eager.getAttribute("fetchpriority")).toBe("high");
    const lazy = render(<ResponsiveImage image={image} sizes={sizes} />).container.querySelector("img")!;
    expect(lazy.getAttribute("loading")).toBe("lazy");
  });
});
