/**
 * The lock as a shop meets it (subscriptions/feature-access ux.md, Q20, Q26, Q29; spec A5, A7): a paid
 * action is drawn unchanged when held, and as the same button with a lock that opens the plan sheet when
 * not; never disabled; Talk to us opens the contact sheet with the feature and shop already written; a
 * refusal that names a feature is recognised; /business offers Talk to us in its header and pricing.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null, status: "unauthenticated" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/" }));

import { LockedAction } from "@/components/subscriptions/locked-action";
import { ShopPlanProvider } from "@/components/subscriptions/plan-context";
import { lockedFeatureOf } from "@/components/subscriptions/lock-refusal";
import { ApiError } from "@/lib/api-error";
import { ALL_ON } from "@server/subscriptions/feature-access.types";

const NONE = { channels: false, storefront: false, imageEnhancement: false, socialSelling: false };

function inShop(features: typeof NONE, node: React.ReactNode) {
  return render(<ShopPlanProvider shop="Zara Hijab House" features={features}>{node}</ShopPlanProvider>);
}

describe("a paid action (feature-access Q20, Q29)", () => {
  it("is drawn unchanged when the shop holds the feature", () => {
    const onClick = vi.fn();
    inShop(ALL_ON, (
      <LockedAction feature="channels" label="Connect Amazon">
        <button type="button" onClick={onClick}>Connect Amazon</button>
      </LockedAction>
    ));
    fireEvent.click(screen.getByRole("button", { name: "Connect Amazon" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByText(/part of the ₹699 plan/)).toBeNull();
  });

  it("keeps its place when locked, never disabled, and opens the plan sheet instead of acting", async () => {
    const onClick = vi.fn();
    inShop(NONE, (
      <LockedAction feature="image_enhancement" label="Improve">
        <button type="button" onClick={onClick}>Improve</button>
      </LockedAction>
    ));
    const button = screen.getByRole("button", { name: "Improve" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Image enhancement is part of the ₹699 plan")).toBeTruthy());
    expect(screen.getByText("₹699 a month, GST included. Everything you've set up stays.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Talk to us" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not now" })).toBeTruthy();
  });

  it("Talk to us opens the contact sheet with the feature and the shop already written (Q26)", async () => {
    inShop(NONE, <LockedAction feature="channels" label="Connect Amazon"><button type="button">x</button></LockedAction>);
    fireEvent.click(screen.getByRole("button", { name: "Connect Amazon" }));
    fireEvent.click(await screen.findByRole("button", { name: "Talk to us" }));
    const whatsapp = await screen.findByRole("link", { name: /WhatsApp/i });
    expect(decodeURIComponent(whatsapp.getAttribute("href") ?? "")).toContain("Hi, I'd like Channels for Zara Hijab House.");
  });
});

describe("a refusal that names a lock (ux.md Stale, D4)", () => {
  it("names the feature from a 403 carrying its detail, and nothing else", () => {
    expect(lockedFeatureOf(new ApiError("x", 403, [{ path: "feature", message: "storefront" }]))).toBe("storefront");
    expect(lockedFeatureOf(new ApiError("x", 403, []))).toBeNull();
    expect(lockedFeatureOf(new ApiError("x", 400, [{ path: "feature", message: "channels" }]))).toBeNull();
    expect(lockedFeatureOf(new Error("x"))).toBeNull();
  });
});

describe("/business (spec A7, Q30)", () => {
  it("offers Talk to us in the header and on the pricing card", async () => {
    const { BusinessPage } = await import("@/components/org/business/business-page");
    const { AUDIENCE } = await import("@/components/org/business/business-copy");
    render(<BusinessPage audience={AUDIENCE.SHOP} />);
    expect(screen.getAllByRole("button", { name: "Talk to us" }).length).toBeGreaterThanOrEqual(2);
  });
});
