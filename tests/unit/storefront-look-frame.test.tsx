/**
 * storefront-themes D12 without a server: a picker frame shows the theme's pattern until the
 * preview arrives and says "Preview unavailable" with Try again when it does not (ux.md picker:
 * Loading, Partial); inside the frame a link goes nowhere and a tapped section is posted to our
 * own origin only.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LookFrame } from "@/components/org/look/look-frame";
import { LOOK_COPY } from "@/components/org/look/look-copy";
import { PREVIEW_MESSAGE, PreviewFrameGuard } from "@/components/storefront/preview/preview-frame-guard";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 195 });
});

afterEach(() => vi.restoreAllMocks());

/** jsdom fetches nothing: the frame's document is set by hand, then its load fired. */
function load(frame: HTMLIFrameElement, body: string) {
  frame.contentDocument!.body.innerHTML = body;
  fireEvent.load(frame);
}

describe("look frame (ux.md picker: Loading, Partial)", () => {
  const frame = () => screen.getByTitle("Darbar") as HTMLIFrameElement;

  it("holds the theme's pattern and hides the page until it has drawn", () => {
    const { container } = render(<LookFrame src="about:blank" theme="darbar" palette="navy" title="Darbar" />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.dataset.theme).toBe("darbar");
    expect(box.dataset.palette).toBe("navy");
    expect(box.className).toContain("bg-theme-pattern");
    expect(frame().className).toContain("opacity-0");
    load(frame(), '<div data-storefront-preview=""></div>');
    expect(frame().className).toContain("opacity-100");
    expect(screen.queryByText(LOOK_COPY.previewUnavailable)).toBeNull();
  });

  it("a page without the preview's marker is Preview unavailable, and Try again loads it again", () => {
    render(<LookFrame src="about:blank" theme="darbar" palette="navy" title="Darbar" />);
    const first = frame();
    load(first, "<h1>404</h1>");
    expect(screen.getByText(LOOK_COPY.previewUnavailable)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: LOOK_COPY.tryAgain }));
    expect(screen.queryByText(LOOK_COPY.previewUnavailable)).toBeNull();
    expect(frame()).not.toBe(first);
  });

  it("the full-screen preview says its own words (ux.md preview & publish, Retryable error)", () => {
    render(<LookFrame src="about:blank" theme="darbar" palette="navy" title="Darbar" failedCopy={LOOK_COPY.previewFailed} />);
    load(frame(), "");
    expect(screen.getByText("Couldn't load your preview.")).toBeTruthy();
  });
});

describe("preview frame guard (D12)", () => {
  it("stops a link and posts the tapped section to our own origin", () => {
    const post = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    Object.defineProperty(window, "parent", { configurable: true, value: { postMessage: post } });
    render(
      <>
        <PreviewFrameGuard />
        <div data-section="deals">
          <a href="/store/zaveri/shop?deals=1">Shop the deal</a>
        </div>
      </>,
    );
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByText("Shop the deal").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(post).toHaveBeenCalledWith({ type: PREVIEW_MESSAGE.SECTION, section: "deals" }, window.location.origin);
    Object.defineProperty(window, "parent", { configurable: true, value: window });
  });

  it("stops the header's search form, which would load an unframeable page", () => {
    render(
      <>
        <PreviewFrameGuard />
        <form action="/store/zaveri/shop" aria-label="search" />
      </>,
    );
    const event = new Event("submit", { bubbles: true, cancelable: true });
    screen.getByRole("form", { name: "search" }).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
