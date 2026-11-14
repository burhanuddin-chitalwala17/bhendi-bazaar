/**
 * storefront-font unit 3 (ux.md journeys 3–5; Look and Font sheet matrix): the Font row on a card,
 * the picker of samples in the shop's own name, the preview carrying the face, and publish sending
 * it. The chrome draws the published face (R2, A1).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ publishLook: vi.fn(), revertLook: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: h.refresh }), usePathname: () => "/store/niqab-boutique" }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/org/orgStorefrontApiClient", () => ({
  orgStorefrontApiClient: { publishLook: h.publishLook, revertLook: h.revertLook },
}));
vi.mock("@/components/org/share/share-shop-sheet", () => ({
  ShareShopSheet: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));
vi.mock("@/components/org/look/look-frame", () => ({
  FRAME_DEVICE: { PHONE: { width: 390, height: 844 }, DESKTOP: { width: 1280, height: 800 } },
  LookFrame: ({ src, title }: { src: string; title: string }) => <div data-frame title={title} data-src={src} />,
}));
// The picker's phone half; the popover half is the same list (ADR-0040 decision 1).
vi.mock("@/hooks/core/useMediaQuery", async (original) => ({
  ...(await original<typeof import("@/hooks/core/useMediaQuery")>()),
  useIsTabletUp: () => false,
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }) }));
vi.mock("@/context/AuthSheetContext", () => ({ useAuthSheet: () => ({ open: vi.fn() }) }));
vi.mock("@/components/support/contact-launcher", () => ({
  ContactLauncher: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("next/font/google", () => {
  const face = () => ({ variable: "face", className: "face", style: {} });
  return { Space_Grotesk: face, Geist_Mono: face, Jost: face, Cormorant_Garamond: face, DM_Mono: face, DM_Sans: face, Mulish: face, Marcellus: face, Poppins: face };
});

import { LookPicker } from "@/components/org/look/look-picker";
import { FONT_COPY } from "@/components/org/look/look-font-copy";
import { LOOK_COPY } from "@/components/org/look/look-copy";
import { lookPreviewHref } from "@/components/storefront/preview/preview-href";
import type { StorefrontLookState } from "@server/catalog/storefront-look.types";

const LIVE_BLOOM: StorefrontLookState = {
  orgId: "org_1",
  handle: "niqab-boutique",
  name: "Niqab Boutique",
  live: { theme: "bloom", palette: "blush", font: null },
  lookVersion: 5,
  publishedAt: "2026-11-01T09:00:00.000Z",
  previous: null,
  suggested: null,
};

// An open sheet hides the page from the accessibility tree, so cards are found by markup.
const card = (theme: string) =>
  [...document.querySelectorAll("article")].find((a) => a.querySelector("h2")?.textContent === theme) as HTMLElement;

describe("the Font row (ux.md Look, First use; storefront-font R4, Q9)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the template's own face as its default on every card", () => {
    render(<LookPicker look={LIVE_BLOOM} share={null} />);
    expect(within(card("Bloom")).getByRole("button", { name: /DM Sans/ }).textContent).toContain(FONT_COPY.templateDefault);
    expect(within(card("Darbar")).getByRole("button", { name: /Jost/ }).textContent).toContain(FONT_COPY.templateDefault);
  });

  it("opens the samples in the shop's own name, suggested for the template first, then more fonts", () => {
    render(<LookPicker look={LIVE_BLOOM} share={null} />);
    fireEvent.click(within(card("Bloom")).getByRole("button", { name: /DM Sans/ }));
    expect(screen.getByRole("dialog", { name: FONT_COPY.title })).toBeTruthy();
    expect(screen.getAllByText(FONT_COPY.help).length).toBeGreaterThan(0);
    expect(screen.getByText(FONT_COPY.suggestedFor("Bloom"))).toBeTruthy();
    expect(screen.getByText(FONT_COPY.more)).toBeTruthy();
    const options = screen.getAllByRole("button", { pressed: false }).concat(screen.getAllByRole("button", { pressed: true }))
      .filter((b) => b.closest("li"));
    expect(options).toHaveLength(8);
    for (const option of options) expect(option.textContent).toContain("Niqab Boutique");
    const first = screen.getByRole("list", { name: FONT_COPY.suggestedFor("Bloom") }).querySelector("button")!;
    expect(first.textContent).toContain("DM Sans");
    expect(first.getAttribute("aria-pressed")).toBe("true");
  });

  it("a long shop name is cut at 24 characters in the samples (ux.md Long content)", () => {
    render(<LookPicker look={{ ...LIVE_BLOOM, name: "Niqab Boutique by Ayesha Modest Wear House" }} share={null} />);
    fireEvent.click(within(card("Bloom")).getByRole("button", { name: /DM Sans/ }));
    expect(screen.getByRole("list", { name: FONT_COPY.suggestedFor("Bloom") }).querySelector("button")!.textContent).toContain("Niqab Boutique by Ayesha…");
  });
});

describe("choosing, previewing and publishing a face (ux.md journeys 3–5; storefront-font A1, A3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a chosen face redraws that card's preview and the row names it", () => {
    render(<LookPicker look={LIVE_BLOOM} share={null} />);
    fireEvent.click(within(card("Bloom")).getByRole("button", { name: /DM Sans/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Marcellus,/ }));
    expect(card("Bloom").querySelector("[data-frame]")!.getAttribute("data-src")).toBe(
      lookPreviewHref("org_1", "bloom", "blush", undefined, 0, "marcellus"),
    );
    expect(within(card("Bloom")).getByRole("button", { name: /Marcellus/ }).textContent).not.toContain(FONT_COPY.templateDefault);
  });

  it("the face carries to another template, and is what Publish sends (R6)", async () => {
    h.publishLook.mockResolvedValue({ ...LIVE_BLOOM, live: { theme: "darbar", palette: "emerald", font: "marcellus" }, lookVersion: 6 });
    render(<LookPicker look={LIVE_BLOOM} share={null} />);
    fireEvent.click(within(card("Bloom")).getByRole("button", { name: /DM Sans/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Marcellus,/ }));
    expect(within(card("Darbar")).getByRole("button", { name: /Marcellus/ })).toBeTruthy();

    fireEvent.click(within(card("Darbar")).getByRole("button", { name: LOOK_COPY.preview }));
    fireEvent.click(screen.getByRole("button", { name: LOOK_COPY.publishThisLook }));
    expect(screen.getByText(FONT_COPY.publishTitle("Darbar", "Marcellus"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: LOOK_COPY.publish }));
    await waitFor(() =>
      expect(h.publishLook).toHaveBeenCalledWith("org_1", { theme: "darbar", palette: "emerald", font: "marcellus", lookVersion: 5 }),
    );
  });

  it("Use template default sends no face, so the template's own returns (A3)", async () => {
    h.publishLook.mockResolvedValue(LIVE_BLOOM);
    render(<LookPicker look={{ ...LIVE_BLOOM, live: { ...LIVE_BLOOM.live, font: "marcellus" } }} share={null} />);
    fireEvent.click(within(card("Bloom")).getByRole("button", { name: /Marcellus/ }));
    fireEvent.click(screen.getByRole("button", { name: FONT_COPY.useDefault }));
    expect(within(card("Bloom")).getByRole("button", { name: /DM Sans/ }).textContent).toContain(FONT_COPY.templateDefault);
    fireEvent.click(within(card("Bloom")).getByRole("button", { name: LOOK_COPY.preview }));
    fireEvent.click(screen.getByRole("button", { name: LOOK_COPY.publishThisLook }));
    fireEvent.click(screen.getByRole("button", { name: LOOK_COPY.publish }));
    await waitFor(() =>
      expect(h.publishLook).toHaveBeenCalledWith("org_1", { theme: "bloom", palette: "blush", font: null, lookVersion: 5 }),
    );
  });
});

describe("a template's own face, picked, is kept across templates (storefront-font R6)", () => {
  it("Jost picked on Darbar stays Jost on Bloom; only Use template default resets", () => {
    render(<LookPicker look={LIVE_BLOOM} share={null} />);
    fireEvent.click(within(card("Darbar")).getByRole("button", { name: /Jost/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Jost,/ }));
    expect(within(card("Bloom")).getByRole("button", { name: /Jost/ }).textContent).not.toContain(FONT_COPY.templateDefault);
    expect(screen.getByRole("status").textContent).toBe(FONT_COPY.previewing);
  });
});

describe("the published face reaches the shop's pages (storefront-font R2, D5)", () => {
  it("the themed shell carries data-font only when a face is chosen", async () => {
    const { ThemedShell } = await import("@/components/storefront/themed/chrome/themed-shell");
    const shop = { handle: "niqab-boutique", name: "Niqab Boutique", logoUrl: null, themeKey: "bloom", paletteKey: "blush" } as const;
    const { container, rerender } = render(<ThemedShell shop={{ ...shop, fontKey: "marcellus" }}>x</ThemedShell>);
    expect(container.querySelector("[data-theme]")!.getAttribute("data-font")).toBe("marcellus");
    rerender(<ThemedShell shop={{ ...shop, fontKey: null }}>x</ThemedShell>);
    expect(container.querySelector("[data-theme]")!.hasAttribute("data-font")).toBe(false);
  });
});
