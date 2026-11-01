/**
 * seller-onboarding U2 (R1, A1; D4): signed out, the create screen asks for sign-in in place
 * and returns here, instead of the edge bouncing to a separate page.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { requireSession, open } = vi.hoisted(() => ({ requireSession: vi.fn(), open: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireSession }));
vi.mock("@/context/AuthSheetContext", () => ({ useAuthSheet: () => ({ open }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import NewOrgPage from "@/app/(org)/org/new/page";
import { signInAtEdge } from "@/middleware";
import { ForbiddenError, UnauthorizedError } from "@server/shared/domain-error";

beforeEach(() => {
  requireSession.mockReset();
  open.mockReset();
});

describe("/org/new", () => {
  it("signed out: says why, offers the sign-in sheet, and shows no form (seller-onboarding ux Refused)", async () => {
    requireSession.mockRejectedValue(new UnauthorizedError());
    render(await NewOrgPage());
    expect(screen.getByText("Sign in to open your shop.")).toBeInTheDocument();
    screen.getByRole("button", { name: "Sign in" }).click();
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ reason: "Sign in to open your shop." }));
    expect(screen.queryByLabelText(/Shop name/)).toBeNull();
  });

  it("signed in: the form, with the link preview on this app's own origin (seller-onboarding A1)", async () => {
    requireSession.mockResolvedValue({ user: { id: "user_1", email: "noor@example.com" } });
    render(await NewOrgPage());
    expect(screen.getByLabelText(/Shop name/)).toBeInTheDocument();
    expect(screen.getByText(/^Your link: localhost:3000\/store\//)).toBeInTheDocument();
  });

  it("a blocked account is still refused, not shown the sign-in prompt", async () => {
    requireSession.mockRejectedValue(new ForbiddenError("Your account has been suspended"));
    await expect(NewOrgPage()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("the edge sends a signed-out visitor to sign in", () => {
  it("everywhere in the portals except the create screen itself (seller-onboarding D4)", () => {
    expect(signInAtEdge("/org/new")).toBe(false);
    for (const path of ["/org", "/org/new/x", "/org/newx", "/org/abc", "/org/abc/products", "/admin", "/admin/orders"]) {
      expect(signInAtEdge(path), path).toBe(true);
    }
    expect(signInAtEdge("/")).toBe(false);
    expect(signInAtEdge("/orgs")).toBe(true);
  });
});
