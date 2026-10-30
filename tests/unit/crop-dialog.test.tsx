/**
 * The crop sheet never greys a button (owner rule; ADR-0053): while its upload runs a tap is
 * ignored and the button says "Uploading…", so a double tap cannot spend two uploads.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("react-easy-crop", () => ({ default: () => <div data-testid="cropper" /> }));
const { CropDialog } = await import("@/components/product/crop-dialog");

function renderSheet(busy: boolean) {
  const handlers = { onUseAsIs: vi.fn(), onUseCrop: vi.fn(), onUseAllAsIs: vi.fn(), onCancel: vi.fn() };
  render(<CropDialog photo={{ id: "1", src: "blob:x" }} remaining={1} busy={busy} {...handlers} />);
  return handlers;
}

describe("the crop sheet", () => {
  it("disables nothing while uploading and ignores the taps (spec A8)", () => {
    const handlers = renderSheet(true);
    expect(document.body.querySelectorAll("[disabled]")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Use as is" }));
    fireEvent.click(screen.getByRole("button", { name: "Use all as is" }));
    fireEvent.click(screen.getByRole("button", { name: /Uploading…/ }));
    expect(handlers.onUseAsIs).not.toHaveBeenCalled();
    expect(handlers.onUseAllAsIs).not.toHaveBeenCalled();
    expect(handlers.onUseCrop).not.toHaveBeenCalled();
  });

  it("answers a tap when free", () => {
    const handlers = renderSheet(false);
    fireEvent.click(screen.getByRole("button", { name: "Use as is" }));
    expect(handlers.onUseAsIs).toHaveBeenCalledTimes(1);
    // The frame has not loaded in the test, so the crop says why it waits instead of being greyed.
    fireEvent.click(screen.getByRole("button", { name: /Use this crop/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Wait for the photo to load");
  });
});
