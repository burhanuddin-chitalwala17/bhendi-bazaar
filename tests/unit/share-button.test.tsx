/**
 * Regression: the bidding page passed `size="icon"` without `showLabel={false}`, and
 * the label defaulted to on. `size="icon"` is a fixed `size-9` square, so icon plus
 * label overflowed it and `justify-center` pushed the icon outside the box — onto the
 * product heading beside it, with the hover background left behind on the label only.
 * Pairing the two props by hand is what failed, so the label now follows the size.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShareButton } from "@/components/shared/ShareButton";

describe("ShareButton", () => {
  it("renders no label at icon size, so nothing overflows the square", () => {
    render(<ShareButton url="/bid/abc" size="icon" variant="ghost" />);

    expect(screen.queryByText("Share")).toBeNull();
  });

  it("still labels the button at every other size", () => {
    render(<ShareButton url="/bid/abc" />);

    expect(screen.getByText("Share")).toBeInTheDocument();
  });

  it("lets a caller override either way", () => {
    const { unmount } = render(<ShareButton url="/o/1" size="sm" showLabel={false} />);
    expect(screen.queryByText("Share")).toBeNull();
    unmount();

    render(<ShareButton url="/o/1" size="icon" showLabel />);
    expect(screen.getByText("Share")).toBeInTheDocument();
  });
});
