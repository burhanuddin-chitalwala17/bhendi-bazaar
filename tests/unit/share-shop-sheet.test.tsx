/**
 * Share (seller-onboarding U6; R10, A2; D13; Q3). The first share ticks step 5 only once the server
 * has it, a failed record is retried on the next tap, and the WhatsApp message survives any shop name.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ONBOARDING_STEP, type OnboardingStatus } from "@server/catalog/org-onboarding.types";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/org/o1",
}));
const toastSuccess = vi.fn();
const toastError = vi.fn();
type ToastAction = { label: string; onClick: () => void };
const toastAction = vi.fn<(a: ToastAction) => void>();
vi.mock("sonner", () => ({
  toast: {
    success: (m: string, o?: { action?: ToastAction }) => {
      toastSuccess(m);
      if (o?.action) toastAction(o.action);
    },
    error: (m: string) => toastError(m),
  },
}));
const markShared = vi.fn();
vi.mock("@/components/org/home/setupApiClient", () => ({
  setupApiClient: { markShared: (id: string) => markShared(id), hide: vi.fn(), show: vi.fn() },
}));

const { ShareShopSheet } = await import("@/components/org/share/share-shop-sheet");
const { SetupList } = await import("@/components/org/home/setup-list");
const { whatsappHref } = await import("@/components/org/share/share-copy");
const { HomeShareLink } = await import("@/components/org/home/home-share");

const shop = {
  name: "Noor & Sons Attar",
  path: "/store/noor-sons",
  url: "https://bb.test/store/noor-sons",
  preview: { title: "Noor & Sons Attar", description: "Attar since 1920", image: null },
};
const writeText = vi.fn();

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  refresh.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  toastAction.mockReset();
  markShared.mockReset().mockResolvedValue({ ok: true });
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

function openSheet(setup: { shared: boolean; doneCount: number } | null) {
  render(<ShareShopSheet orgId="o1" shop={shop} setup={setup} trigger={<button type="button">Share</button>} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
}
const whatsapp = () => screen.getByRole("link", { name: "Share on WhatsApp" });

describe("the WhatsApp message (R10)", () => {
  it("carries the copy deck's whole message, even when the shop's name has an ampersand", () => {
    const href = new URL(whatsappHref(shop.name, shop.url));
    expect(href.origin).toBe("https://wa.me");
    expect(href.searchParams.get("text")).toBe("Visit Noor & Sons Attar online: https://bb.test/store/noor-sons");
  });
});

describe("the share sheet (D13)", () => {
  it("shows the link, the store's preview card and the three actions", () => {
    openSheet({ shared: false, doneCount: 4 });
    expect(screen.getByText("bb.test/store/noor-sons")).toBeInTheDocument();
    expect(screen.getByText("Attar since 1920")).toBeInTheDocument();
    expect(whatsapp().getAttribute("href")).toBe(whatsappHref(shop.name, shop.url));
    expect(screen.getByRole("button", { name: "Copy link" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "See as a buyer" }).getAttribute("href")).toBe("/store/noor-sons");
  });

  it("records the first share and says the new count (A2: 'Shared · 5 of 5 done')", async () => {
    openSheet({ shared: false, doneCount: 4 });
    fireEvent.click(whatsapp());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Shared · 5 of 5 done"));
    expect(markShared).toHaveBeenCalledWith("o1");
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps a failed record silent, and tries again on the next tap", async () => {
    markShared.mockRejectedValueOnce(new Error("offline"));
    openSheet({ shared: false, doneCount: 4 });
    fireEvent.click(whatsapp());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Shared"));
    expect(toastError).not.toHaveBeenCalled();

    fireEvent.click(whatsapp());
    await waitFor(() => expect(markShared).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(toastSuccess).toHaveBeenLastCalledWith("Shared · 5 of 5 done"));
  });

  it("follows the prop when a refresh says step 5 is done, so a mounted sheet never says '6 of 5'", async () => {
    const trigger = <button type="button">Share</button>;
    const { rerender } = render(<ShareShopSheet orgId="o1" shop={shop} setup={{ shared: false, doneCount: 4 }} trigger={trigger} />);
    rerender(<ShareShopSheet orgId="o1" shop={shop} setup={{ shared: true, doneCount: 5 }} trigger={trigger} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    fireEvent.click(whatsapp());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Shared"));
    expect(markShared).not.toHaveBeenCalled();
  });

  it("asks the server nothing once the shop has shared", async () => {
    openSheet({ shared: true, doneCount: 5 });
    fireEvent.click(whatsapp());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Shared"));
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Link copied"));
    expect(markShared).not.toHaveBeenCalled();
  });

  it("copies the link, says where to paste it, and counts the copy as the first share (Q3)", async () => {
    openSheet({ shared: false, doneCount: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(markShared).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(shop.url);
    expect(toastSuccess).toHaveBeenCalledWith("Link copied");
    expect(screen.getByText("Copied. Paste it in any chat.")).toBeInTheDocument();
  });

  it("keeps a failed record after a copy silent, and the next copy tries again (Q32)", async () => {
    markShared.mockRejectedValueOnce(new Error("offline"));
    openSheet({ shared: false, doneCount: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(markShared).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(markShared).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("offers long-press when the copy fails, and does not count it as a share", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    openSheet({ shared: false, doneCount: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByText("Long-press the link to copy it.")).toBeInTheDocument();
    expect(markShared).not.toHaveBeenCalled();
  });
});

describe("step 5 on Home (A2: no back button)", () => {
  const status = {
    steps: [
      { key: ONBOARDING_STEP.OPEN, done: true },
      { key: ONBOARDING_STEP.PRODUCT, done: true },
      { key: ONBOARDING_STEP.ADDRESS, done: true },
      { key: ONBOARDING_STEP.LOOK, done: true },
      { key: ONBOARDING_STEP.SHARE, done: false },
    ],
    doneCount: 4,
    next: ONBOARDING_STEP.SHARE,
    complete: false,
    hidden: false,
  } as OnboardingStatus;

  it("opens the share sheet over Home, with the step's hint on top, instead of leaving for the Shop tab", async () => {
    render(<SetupList orgId="o1" setup={{ ok: true, value: status }} share={shop} />);
    expect(document.querySelectorAll("[role=dialog]")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /share your shop link/i }));
    expect(screen.getByText("Send your link to customers on WhatsApp. They can order without calling you.")).toBeInTheDocument();
    fireEvent.click(whatsapp());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Shared · 5 of 5 done"));
  });
});

describe("after the first product (Q32, D13)", () => {
  const setup = { shared: false, doneCount: 2 };

  it("the product toast carries Share, and Share opens the sheet over Home", async () => {
    render(<HomeShareLink orgId="o1" shop={shop} setup={setup} productToast="Product added · 2 of 5 done" />);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Product added · 2 of 5 done"));
    expect(toastAction).toHaveBeenCalledTimes(1);
    const action = toastAction.mock.calls[0][0];
    expect(action.label).toBe("Share");
    expect(document.querySelectorAll("[role=dialog]")).toHaveLength(0);
    act(() => action.onClick());
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(whatsapp()).toBeInTheDocument();
  });

  it("Home with no product toast raises no toast of its own", () => {
    render(<HomeShareLink orgId="o1" shop={shop} setup={setup} productToast={null} />);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastAction).not.toHaveBeenCalled();
  });
});
