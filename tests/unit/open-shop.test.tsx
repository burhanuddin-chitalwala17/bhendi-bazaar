/**
 * Opening a shop asks three things (org-profile R3, R6, A1; D1; decisions Q2, Q3, Q22): name,
 * mobile and email. Contact person, business name, GST, PAN and description are not accepted
 * from the self-serve body — the admin's own form still takes them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { requireSession, createOrgWithOwner, push, refresh, create } = vi.hoisted(() => ({
  requireSession: vi.fn(),
  createOrgWithOwner: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/admin-auth", () => ({ requireSession }));
vi.mock("@/lib/rate-limit", () => ({ limitRequest: async () => null }));
vi.mock("@server/catalog/org.service", () => ({ adminOrgService: { createOrgWithOwner } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
import { toast } from "sonner";
vi.mock("@/components/org/orgsApiClient", () => ({ orgsApiClient: { create } }));

import { POST } from "@/app/api/orgs/route";
import { openShopSchema } from "@/lib/validation/schemas/org.schema";
import { PHONE_MESSAGE } from "@server/shared/phone";
import { ApiError } from "@/lib/api-error";
import { OpenShopForm } from "@/components/org/open-shop-form";

const everything = {
  name: "Noor Attar House",
  phone: "9876543210",
  email: "noor@example.com",
  contactPerson: "Hussain Bhai",
  businessName: "Noor Attar Pvt Ltd",
  gstNumber: "29ABCDE1234F1Z5",
  panNumber: "ABCDE1234F",
  description: "Hand-made attar since 1962",
  code: "ORG-EVIL",
  isActive: false,
};

beforeEach(() => {
  requireSession.mockReset().mockResolvedValue({ user: { id: "user_1", email: "noor@example.com" } });
  createOrgWithOwner.mockReset().mockResolvedValue({ id: "org_1" });
  create.mockReset().mockResolvedValue({ id: "org_1" });
  push.mockReset();
});

describe("openShopSchema", () => {
  it("keeps exactly name, mobile and email, and drops everything else (spec A1)", () => {
    const parsed = openShopSchema.parse(everything);
    expect(Object.keys(parsed).sort()).toEqual(["email", "name", "phone"]);
    expect(parsed.phone).toBe("+919876543210");
  });

  it("requires the mobile number (spec A1)", () => {
    expect(openShopSchema.safeParse({ name: "Noor Attar House", email: "noor@example.com" }).success).toBe(false);
  });

  it("accepts a mobile from any country (spec A1; international-phone R1; Q26)", () => {
    expect(openShopSchema.parse({ ...everything, phone: "+44 7911 123456" }).phone).toBe("+447911123456");
  });

  it("refuses an invalid number with the shared phone message (spec A1)", () => {
    expect(openShopSchema.safeParse({ ...everything, phone: "12345" }).error?.issues[0].message).toBe(PHONE_MESSAGE);
  });

  it("refuses a two-letter name with the ux copy (spec A1)", () => {
    const result = openShopSchema.safeParse({ ...everything, name: "No" });
    expect(result.error?.issues[0].message).toBe("Use at least 3 letters.");
  });
});

describe("POST /api/orgs", () => {
  it("hands the service only the three fields, whatever the body carries (spec A1)", async () => {
    const response = await POST(
      new NextRequest("https://bhendi-bazaar.com/api/orgs", { method: "POST", body: JSON.stringify(everything) }),
    );
    expect(response.status).toBe(201);
    expect(createOrgWithOwner).toHaveBeenCalledWith(
      { name: "Noor Attar House", phone: "+919876543210", email: "noor@example.com" },
      "user_1",
    );
  });

  it("refuses a body with no mobile and creates nothing (spec A1)", async () => {
    const response = await POST(
      new NextRequest("https://bhendi-bazaar.com/api/orgs", {
        method: "POST",
        body: JSON.stringify({ name: "Noor Attar House", email: "noor@example.com" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(createOrgWithOwner).not.toHaveBeenCalled();
  });
});

const typeMobile = (value: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: /Your mobile number/ }), { target: { value } });

describe("OpenShopForm", () => {
  it("asks three things, says who sees each, and prefills the account email (spec A1)", () => {
    render(<OpenShopForm accountEmail="noor@example.com" storeBase="bhendibazaar.com/store/" />);
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    expect(screen.getByLabelText(/Shop name/)).toHaveAttribute("placeholder", "Noor Attar House");
    expect(screen.getByLabelText(/Email for order updates/)).toHaveValue("noor@example.com");
    expect(screen.getByText("Buyers see this on your shop and every product.")).toBeInTheDocument();
    expect(
      screen.getByText("We'll call or message you about orders and pickups. Buyers never see it."),
    ).toBeInTheDocument();
    expect(screen.getByText("We send new orders here.")).toBeInTheDocument();
    for (const gone of ["Contact Person", "Business Name", "GST", "PAN", "Description", "John Doe", "ABC Traders"]) {
      expect(document.body.textContent).not.toContain(gone);
    }
  });

  it("shows the field messages and sends nothing on a short name and a bad number (spec A1)", async () => {
    render(<OpenShopForm accountEmail="noor@example.com" storeBase="bhendibazaar.com/store/" />);
    fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: "No" } });
    typeMobile("12345");
    fireEvent.click(screen.getByRole("button", { name: "Create my shop" }));
    expect(await screen.findByText("Use at least 3 letters.")).toBeInTheDocument();
    expect(screen.getByText(PHONE_MESSAGE)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("creates with the three fields, says the shop is open and goes to it (spec A1)", async () => {
    render(<OpenShopForm accountEmail="noor@example.com" storeBase="bhendibazaar.com/store/" />);
    fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: "Noor Attar House" } });
    typeMobile("98765 43210");
    fireEvent.click(screen.getByRole("button", { name: "Create my shop" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/org/org_1"));
    expect(create).toHaveBeenCalledWith({ name: "Noor Attar House", phone: "+919876543210", email: "noor@example.com" });
    expect(toast.success).toHaveBeenCalledWith("Your shop is open");
  });

  it("opens one shop when the button is tapped twice, and the button stays tappable (spec A1)", async () => {
    let finish!: (org: { id: string }) => void;
    create.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<OpenShopForm accountEmail="noor@example.com" storeBase="bhendibazaar.com/store/" />);
    fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: "Noor Attar House" } });
    typeMobile("98765 43210");
    fireEvent.click(screen.getByRole("button", { name: "Create my shop" }));
    const button = await screen.findByRole("button", { name: "Opening your shop…" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);
    await new Promise((r) => setTimeout(r, 20));
    expect(create).toHaveBeenCalledTimes(1);
    finish({ id: "org_1" });
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    // Between success and the page changing, a tap still opens nothing more.
    fireEvent.click(screen.getByRole("button", { name: "Create my shop" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("keeps what was typed and says so in plain words when the request never arrives (spec A1)", async () => {
    create.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<OpenShopForm accountEmail="noor@example.com" storeBase="bhendibazaar.com/store/" />);
    fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: "Noor Attar House" } });
    typeMobile("98765 43210");
    fireEvent.click(screen.getByRole("button", { name: "Create my shop" }));
    expect(
      await screen.findByText("Couldn't open your shop. Check your internet and try again."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Shop name/)).toHaveValue("Noor Attar House");
    // A retry is allowed after a failure.
    fireEvent.click(screen.getByRole("button", { name: "Create my shop" }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
  });
});

/**
 * seller-onboarding U2 (R1, A1; D4; Q21, Q27): the screen around the three fields — the link
 * preview, the slow and retry states, and the signed-out refusal.
 */
describe("Create your shop screen (seller-onboarding R1, A1)", () => {
  const BASE = "bhendibazaar.com/store/";

  it("previews the link the server will try first, as the name is typed (seller-onboarding A1, Q21)", () => {
    render(<OpenShopForm accountEmail="noor@example.com" storeBase={BASE} />);
    fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: "Noor Attar House" } });
    expect(screen.getByText("Your link: bhendibazaar.com/store/noor-attar-house")).toBeInTheDocument();
  });

  it("skips a reserved word exactly as the server does, so the preview cannot drift (seller-onboarding Q27)", () => {
    render(<OpenShopForm accountEmail="noor@example.com" storeBase={BASE} />);
    fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: "Admin" } });
    expect(screen.getByText("Your link: bhendibazaar.com/store/admin-2")).toBeInTheDocument();
  });

  it("truncates a long link in the middle, keeping both ends (seller-onboarding ux Long content)", () => {
    render(<OpenShopForm accountEmail="noor@example.com" storeBase={BASE} />);
    fireEvent.change(screen.getByLabelText(/Shop name/), {
      target: { value: "Noor Attar House of Hand Made Perfumes and Oud Since Nineteen Sixty Two" },
    });
    const preview = screen.getByText(/^Your link: /).textContent!;
    expect(preview).toContain("…");
    expect(preview.startsWith("Your link: bhendibazaar.com/store/noor")).toBe(true);
    expect(preview.endsWith("sixty-two")).toBe(true);
  });

  it('says "Still opening…" after 3 seconds of waiting (seller-onboarding ux Slow)', async () => {
    create.mockReturnValue(new Promise(() => {}));
    render(<OpenShopForm accountEmail="noor@example.com" storeBase={BASE} />);
    fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: "Noor Attar House" } });
    typeMobile("98765 43210");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Create my shop" }));
      await screen.findByRole("button", { name: "Opening your shop…" });
      expect(screen.queryByText("Still opening… don't close this page.")).toBeNull();
      await act(() => vi.advanceTimersByTimeAsync(3100));
      expect(screen.getByText("Still opening… don't close this page.")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers "Try again" on a dropped connection, and it sends again (seller-onboarding ux Retryable error)', async () => {
    create.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({ id: "org_1" });
    render(<OpenShopForm accountEmail="noor@example.com" storeBase={BASE} />);
    fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: "Noor Attar House" } });
    typeMobile("98765 43210");
    fireEvent.click(screen.getByRole("button", { name: "Create my shop" }));
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/org/org_1"));
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("shows the ux copy, not the server's generic message, on a server fault (seller-onboarding ux Retryable error)", async () => {
    create.mockRejectedValue(new ApiError("Something went wrong", 500));
    render(<OpenShopForm accountEmail="noor@example.com" storeBase={BASE} />);
    fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: "Noor Attar House" } });
    typeMobile("98765 43210");
    fireEvent.click(screen.getByRole("button", { name: "Create my shop" }));
    expect(await screen.findByText("Couldn't open your shop. Check your internet and try again.")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("offers no retry when the server refused the request itself (seller-onboarding ux Terminal error)", async () => {
    create.mockRejectedValue(new ApiError("Your account has been suspended", 403));
    render(<OpenShopForm accountEmail="noor@example.com" storeBase={BASE} />);
    fireEvent.change(screen.getByLabelText(/Shop name/), { target: { value: "Noor Attar House" } });
    typeMobile("98765 43210");
    fireEvent.click(screen.getByRole("button", { name: "Create my shop" }));
    expect(await screen.findByText("Your account has been suspended")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
