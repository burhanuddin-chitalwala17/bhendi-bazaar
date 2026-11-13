/**
 * storefront-themes U5 without a database: the look picker, preview and publish as ux.md words
 * them (journeys 1, 3, 4; picker and preview & publish matrices), the look schemas (D11, own-store
 * Q15, Invariant 4), the preview's frame (D12) and its sample goods.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ publishLook: vi.fn(), revertLook: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: h.refresh }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/org/orgStorefrontApiClient", () => ({
  orgStorefrontApiClient: { publishLook: h.publishLook, revertLook: h.revertLook },
}));
vi.mock("@/components/org/share/share-shop-sheet", () => ({
  ShareShopSheet: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));
// The frames are their own test below; here a card's frame is just its src.
vi.mock("@/components/org/look/look-frame", () => ({
  FRAME_DEVICE: { PHONE: { width: 390, height: 844 }, DESKTOP: { width: 1280, height: 800 } },
  LookFrame: ({ src, title }: { src: string; title: string }) => <div data-frame title={title} data-src={src} />,
}));

import { toast } from "sonner";
import { ApiError } from "@/lib/api-error";
import { LookPicker } from "@/components/org/look/look-picker";
import { LOOK_COPY } from "@/components/org/look/look-copy";
import { storefrontLookSchema, storefrontRevertSchema } from "@/lib/validation/schemas/storefront.schema";
import { lookConflictMessage, LOOK_NOT_KEPT, LOOK_OWNER_ONLY, type StorefrontLookState } from "@server/catalog/storefront-look.types";
import { lookPreviewHref, PREVIEW_VIEW } from "@/components/storefront/preview/preview-href";
import { SAMPLE_GOODS_NOTE, withSampleGoods } from "@/components/storefront/preview/sample-goods";
import type { ThemedPageData } from "@/components/storefront/themed/page-data";

const LIVE_EDGE: StorefrontLookState = {
  orgId: "org_1",
  handle: "zaveri",
  name: "Zaveri & Sons",
  live: { theme: "edge", palette: "graphite", font: null },
  lookVersion: 3,
  publishedAt: "2026-11-01T09:00:00.000Z",
  previous: { theme: "darbar", palette: "navy", font: null, until: "2026-12-01T09:00:00.000Z" },
  suggested: null,
};

const press = (name: string) => fireEvent.click(screen.getAllByRole("button", { name }).at(-1)!);

function previewTheme(theme: string) {
  const card = screen.getByRole("heading", { name: theme }).closest("article")!;
  fireEvent.click(within(card as HTMLElement).getByRole("button", { name: LOOK_COPY.preview }));
}

function openPublish(theme = "Darbar") {
  previewTheme(theme);
  press(LOOK_COPY.publishThisLook);
}

describe("look schemas (D11; Invariant 4)", () => {
  it("takes a theme, one of its own palettes and the version seen", () => {
    expect(storefrontLookSchema.parse({ theme: "darbar", palette: "kumkum", font: null, lookVersion: 2 })).toEqual({
      theme: "darbar",
      palette: "kumkum",
      font: null,
      lookVersion: 2,
    });
  });

  it("takes a listed heading face or null, and refuses any other (storefront-font D4, Q7)", () => {
    const base = { theme: "darbar", palette: "kumkum", lookVersion: 2 };
    expect(storefrontLookSchema.parse({ ...base, font: "marcellus" }).font).toBe("marcellus");
    expect(storefrontLookSchema.parse({ ...base, font: null }).font).toBeNull();
    expect(storefrontLookSchema.safeParse({ ...base, font: "Comic Sans MS" }).success).toBe(false);
    expect(storefrontLookSchema.safeParse({ ...base, font: "var(--font-heading-face)" }).success).toBe(false);
    // Required: a client from before the face existed cannot clear one by leaving it out.
    expect(storefrontLookSchema.safeParse(base).success).toBe(false);
  });

  it("refuses another theme's palette (own-store Q15)", () => {
    expect(storefrontLookSchema.safeParse({ theme: "darbar", palette: "carbon", font: null, lookVersion: 0 }).success).toBe(false);
  });

  it("refuses server-owned fields and an unknown theme", () => {
    for (const body of [
      { theme: "darbar", palette: "navy", font: null, lookVersion: 0, lookPublishedByUserId: "u" },
      { theme: "darbar", palette: "navy", font: null, lookVersion: 0, previousThemeKey: "edge" },
      { theme: "darbar", palette: "navy", font: null, lookVersion: 0, previousFontKey: "jost" },
      { theme: "royal", palette: "navy", font: null, lookVersion: 0 },
      { theme: "darbar", palette: "navy", font: null },
    ]) {
      expect(storefrontLookSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
    // Switch back restores the server's record, never a look named in the payload (Q4).
    expect(storefrontRevertSchema.safeParse({ lookVersion: 1, theme: "edge" }).success).toBe(false);
  });

  it("words a refusal as ux.md journey 4 does", () => {
    const now = new Date("2026-11-01T10:00:00Z");
    expect(lookConflictMessage("Murtaza", "edge", new Date("2026-11-01T09:58:00Z"), now)).toBe("Murtaza published Edge 2 min ago.");
    expect(lookConflictMessage(null, null, null, now)).toBe("Someone published your old page 1 min ago.");
    expect(LOOK_COPY.ownerOnly).toBe(LOOK_OWNER_ONLY);
    expect(LOOK_OWNER_ONLY).toBe("Only the shop's owner can change its look.");
  });
});

describe("look picker (ux.md picker)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows four themes, each previewing the shop's own page, with the live one tagged", () => {
    render(<LookPicker look={LIVE_EDGE} share={null} />);
    expect(screen.getByText(LOOK_COPY.intro)).toBeTruthy();
    for (const name of ["Edge", "Darbar", "Bloom", "Daily"]) expect(screen.getByRole("heading", { name })).toBeTruthy();
    expect(screen.getAllByText(LOOK_COPY.liveNow)).toHaveLength(1);
    const edge = screen.getByRole("heading", { name: "Edge" }).closest("article")!;
    expect(edge.textContent).toContain(LOOK_COPY.liveNow);
    // The live theme's card opens on the live palette.
    expect(edge.querySelector("[data-frame]")!.getAttribute("data-src")).toBe(lookPreviewHref("org_1", "edge", "graphite"));
    expect(screen.getByRole("button", { name: "Switch back to Darbar" })).toBeTruthy();
  });

  it("an unthemed shop has no Live tag and no Switch back", () => {
    render(<LookPicker look={{ ...LIVE_EDGE, live: { theme: null, palette: null, font: null }, previous: null }} share={null} />);
    expect(screen.queryByText(LOOK_COPY.liveNow)).toBeNull();
    expect(screen.queryByRole("button", { name: /Switch back/ })).toBeNull();
  });

  it("a palette dot redraws that card's preview", () => {
    render(<LookPicker look={LIVE_EDGE} share={null} />);
    const darbar = screen.getByRole("heading", { name: "Darbar" }).closest("article")!;
    fireEvent.click(screen.getByRole("radio", { name: "Kumkum" }));
    expect(darbar.querySelector("[data-frame]")!.getAttribute("data-src")).toBe(lookPreviewHref("org_1", "darbar", "kumkum"));
  });
});

describe("preview & publish (ux.md journeys 1 and 4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("previews landing and shop, then publishes at the version read, with ux.md's toast and Share", async () => {
    h.publishLook.mockResolvedValue({ ...LIVE_EDGE, live: { theme: "darbar", palette: "emerald" }, lookVersion: 4 });
    render(<LookPicker look={LIVE_EDGE} share={{ name: "Zaveri & Sons", path: "/store/zaveri", url: "https://bb.test/store/zaveri", preview: { title: "Z", description: "", image: null } }} />);
    previewTheme("Darbar");

    const frames = () => screen.getAllByTitle("Darbar").map((f) => f.getAttribute("data-src"));
    expect(frames()).toContain(lookPreviewHref("org_1", "darbar", "emerald", PREVIEW_VIEW.LANDING));
    press(LOOK_COPY.shop);
    expect(frames()).toContain(lookPreviewHref("org_1", "darbar", "emerald", PREVIEW_VIEW.SHOP));

    press(LOOK_COPY.publishThisLook);
    expect(screen.getByText("Publish Darbar?")).toBeTruthy();
    expect(screen.getByText(LOOK_COPY.publishBody)).toBeTruthy();
    expect(screen.getByRole("button", { name: LOOK_COPY.notYet })).toBeTruthy();
    press(LOOK_COPY.publish);

    await waitFor(() =>
      expect(h.publishLook).toHaveBeenCalledWith("org_1", { theme: "darbar", palette: "emerald", font: null, lookVersion: 3 }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(LOOK_COPY.published));
    expect(h.refresh).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: LOOK_COPY.shareShop })).toBeTruthy();
  });

  it("another member published first: their name and time, See it, and Publish mine anyway resends", async () => {
    h.publishLook.mockRejectedValueOnce(new ApiError("Murtaza published Bloom 2 min ago.", 409));
    const { rerender } = render(<LookPicker look={LIVE_EDGE} share={null} />);
    openPublish();
    press(LOOK_COPY.publish);
    expect(await screen.findByText("Murtaza published Bloom 2 min ago.")).toBeTruthy();
    expect(h.refresh).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: LOOK_COPY.seeIt })).toBeTruthy();

    // The refresh brings the other member's version; the resend must carry it, or it is refused again.
    rerender(<LookPicker look={{ ...LIVE_EDGE, live: { theme: "bloom", palette: "peach", font: null }, lookVersion: 4 }} share={null} />);
    h.publishLook.mockResolvedValueOnce(LIVE_EDGE);
    press(LOOK_COPY.publishAnyway);
    await waitFor(() => expect(h.publishLook).toHaveBeenCalledTimes(2));
    expect(h.publishLook).toHaveBeenLastCalledWith("org_1", expect.objectContaining({ theme: "darbar", lookVersion: 4 }));
  });

  it("a failed publish says what is still live, and Try again stays tappable", async () => {
    h.publishLook.mockRejectedValueOnce(new ApiError("Something went wrong", 500));
    render(<LookPicker look={LIVE_EDGE} share={null} />);
    openPublish();
    press(LOOK_COPY.publish);
    expect(await screen.findByText("Not published. Your shop still shows Edge.")).toBeTruthy();
    const retry = screen.getByRole("button", { name: LOOK_COPY.tryAgain });
    expect(retry.hasAttribute("disabled")).toBe(false);
  });

  it("the Publish button is never disabled while a publish is on its way (ADR-0053)", async () => {
    h.publishLook.mockReturnValue(new Promise(() => {}));
    render(<LookPicker look={LIVE_EDGE} share={null} />);
    openPublish();
    press(LOOK_COPY.publish);
    await waitFor(() => expect(h.publishLook).toHaveBeenCalled());
    for (const button of screen.getAllByRole("button")) expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("switch back asks first, then restores, with ux.md's toast (journey 3)", async () => {
    h.revertLook.mockResolvedValue({ ...LIVE_EDGE, live: { theme: "darbar", palette: "navy" }, lookVersion: 4 });
    render(<LookPicker look={LIVE_EDGE} share={null} />);
    press("Switch back to Darbar");
    expect(screen.getByText("Switch back to Darbar?")).toBeTruthy();
    press(LOOK_COPY.switchBackConfirm);
    await waitFor(() => expect(h.revertLook).toHaveBeenCalledWith("org_1", 3));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Switched back to Darbar."));
  });

  it("switch back after the 30 days shows the refusal and offers no resend", async () => {
    h.revertLook.mockRejectedValueOnce(new ApiError(LOOK_NOT_KEPT, 410));
    render(<LookPicker look={LIVE_EDGE} share={null} />);
    press("Switch back to Darbar");
    press(LOOK_COPY.switchBackConfirm);
    expect(await screen.findByText(LOOK_NOT_KEPT)).toBeTruthy();
    expect(h.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: LOOK_COPY.switchBackConfirm })).toBeNull();
    expect(screen.queryByRole("button", { name: LOOK_COPY.seeIt })).toBeNull();
    expect(screen.getByRole("button", { name: LOOK_COPY.notYet })).toBeTruthy();
  });
});

describe("the preview page's pieces (D12)", () => {
  it("an empty shop previews labelled sample goods; a shop with goods keeps its own", () => {
    const empty = { name: "Zaveri", handle: "zaveri", productCount: 0, bestSelling: [], newIn: [], dealProducts: [] } as unknown as ThemedPageData;
    const sampled = withSampleGoods(empty, { id: "org_1" });
    expect(sampled.productCount).toBeGreaterThan(0);
    expect(sampled.newIn.every((p) => p.name.startsWith("Sample product"))).toBe(true);
    expect(SAMPLE_GOODS_NOTE).toBe("Showing sample products until you add your own.");
    const stocked = { ...empty, productCount: 3 } as ThemedPageData;
    expect(withSampleGoods(stocked, { id: "org_1" })).toBe(stocked);
  });
});
