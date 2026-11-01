/**
 * Hints are opened by the seller, never by the page (seller-onboarding R4, A5; own-store Q12). A
 * hint that opened itself, or reopened mid-way, is the tour this feature refused to build.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";
import type { OnboardingStatus } from "@server/catalog/org-onboarding.types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { SetupList } = await import("@/components/org/home/setup-list");
const { PageHelp } = await import("@/components/layout/page-help");

const status: OnboardingStatus = {
  steps: [
    { key: ONBOARDING_STEP.OPEN, done: true },
    { key: ONBOARDING_STEP.PRODUCT, done: false },
    { key: ONBOARDING_STEP.ADDRESS, done: false },
    { key: ONBOARDING_STEP.LOOK, done: false },
    { key: ONBOARDING_STEP.SHARE, done: false },
  ],
  doneCount: 1,
  next: ONBOARDING_STEP.PRODUCT,
  complete: false,
  hidden: false,
} as OnboardingStatus;

const renderList = () => render(<SetupList orgId="o1" setup={{ ok: true, value: status }} shopPath="/store/abc" />);
// Read from the DOM, not the accessibility tree: an open modal hides every other dialog from it.
const dialogs = () => Array.from(document.querySelectorAll("[role=dialog]"));

describe("setup-step hints (R4, A5)", () => {
  it("opens nothing on first render of Home", () => {
    renderList();
    expect(dialogs()).toEqual([]);
    // Modals opened together dismiss each other, so the triggers are checked as well.
    for (const step of screen.getAllByRole("button", { name: /^Add|^Share/ })) {
      expect(step).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("opens on the seller's tap, one card at a time, and the last card starts the task", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /add your first product/i }));

    expect(dialogs()).toHaveLength(1);
    expect(screen.getByText("Photos sell. Use daylight and a plain wall.")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Price and stock. You can change them any time.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Price and stock. You can change them any time.")).toBeInTheDocument();
    const task = screen.getByRole("link", { name: "Add product" });
    expect(task.getAttribute("href")).toBe("/org/o1/products/new?from=home");
  });

  it("reopens at card 1 after being closed mid-way", () => {
    renderList();
    const step = () => screen.getByRole("button", { name: /add your first product/i });
    fireEvent.click(step());
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(dialogs()).toEqual([]);

    fireEvent.click(step());
    expect(screen.getByText("Photos sell. Use daylight and a plain wall.")).toBeInTheDocument();
  });

  it("a one-card hint starts its task from that card", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /add a pickup address/i }));
    expect(screen.getByText("Couriers pick up from here. Buyers never see it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add pickup address" }).getAttribute("href")).toBe("/org/o1/locations?from=home");
  });
});

describe('"?" (R5, A5)', () => {
  it("stays shut until tapped, then says what the page is for", () => {
    render(<PageHelp help="locations" />);
    expect(dialogs()).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "What is this page for?" }));
    expect(screen.getByText("Where couriers collect from")).toBeInTheDocument();
    expect(screen.getByText("Couriers pick up from here. Buyers never see it.")).toBeInTheDocument();
  });

  it("a page with no cards still answers with its purpose", () => {
    render(<PageHelp help="earnings" />);
    fireEvent.click(screen.getByRole("button", { name: "What is this page for?" }));
    expect(screen.getByText("What you earned and when it's paid")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(dialogs()).toEqual([]);
  });
});
