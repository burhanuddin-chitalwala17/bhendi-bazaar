/**
 * Shop details, private part (org-profile U3; D7; R5, R6, A3; Q15, Q16, Q21, Q23, Q25).
 * The contact schema refuses what is not name, mobile or email; only the owner may change them;
 * the name sheet says where the name shows before it is written; the old address hears of an
 * email change once per job.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OrgRole } from "@prisma/client";

const h = vi.hoisted(() => ({
  saveSection: vi.fn(),
  saveContact: vi.fn(),
  refresh: vi.fn(),
  updateContactIfUnchanged: vi.fn(),
  findShopDetails: vi.fn(),
  recordAdminAction: vi.fn(),
  send: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: h.refresh }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/org/shopDetailsApiClient", () => ({
  shopDetailsApiClient: { saveSection: h.saveSection, saveContact: h.saveContact },
}));
vi.mock("@/components/shared/image-upload", () => ({
  ImageUpload: ({ label }: { label: string }) => <div>{label}</div>,
}));
vi.mock("@server/catalog/org.repository", () => ({
  orgRepository: { updateContactIfUnchanged: h.updateContactIfUnchanged },
}));
vi.mock("@server/catalog/org-profile.repository", () => ({
  orgProfileRepository: { findShopDetails: h.findShopDetails },
}));
vi.mock("@server/shared/audit/audit.service", () => ({ recordAdminAction: h.recordAdminAction }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: h.send };
  },
}));
vi.mock("@server/identity/account.service", () => ({ accountService: {} }));
import { toast } from "sonner";

import { shopContactSchema } from "@/lib/validation/schemas/shop-details.schema";
import { ShopDetailsEditor } from "@/components/org/shop-details/shop-details-editor";
import { FIELDS, NAME_SHEET_COPY, SHOP_DETAILS_COPY } from "@/components/org/shop-details/shop-details-copy";
import { ApiError } from "@/lib/api-error";
import { shopDetailsService } from "@server/catalog/shop-details.service";
import { SHOP_OWNER_ONLY, type ShopDetailsDto } from "@server/catalog/shop-details.types";
import { SUPPORT_INBOX } from "@server/notifications/templates/layout";
import { orgEmailChangedPayload } from "@server/shared/jobs/org-email-changed.job";

const VERSION = "2026-10-31T10:00:00.000Z";
const NEWER = "2026-10-31T10:05:00.000Z";
const UNTIL = "2027-04-30T00:00:00.000Z";

const shop: ShopDetailsDto = {
  handle: "noor-attar",
  name: "Noor Attar House",
  updatedAt: VERSION,
  phone: "+919876543210",
  email: "noor@example.com",
  contactUpdatedAt: VERSION,
  tagline: "Hand-made attar",
  logoUrl: "https://img/logo.webp",
  about: null,
  aboutJoined: false,
  location: null,
  social: {},
  ownerName: null,
  ownerRole: null,
  ownerQuote: null,
  ownerPhotoUrl: null,
  returnsPreset: "STANDARD",
  promiseNote: null,
  oldDeliveryPolicy: null,
  oldReturnsPolicy: null,
};

const page = () => render(<ShopDetailsEditor orgId="org_1" initial={shop} oldAddressWorksUntil={UNTIL} />);
const at = { expectedUpdatedAt: VERSION };

describe("shopContactSchema (Invariant 4, D7)", () => {
  it("accepts name, mobile or email alone, each with the version read", () => {
    expect(shopContactSchema.safeParse({ name: "Noor Attar", ...at }).success).toBe(true);
    expect(shopContactSchema.safeParse({ phone: "+44 7911 123456", ...at }).success).toBe(true);
    expect(shopContactSchema.safeParse({ email: "noor@example.com", ...at }).success).toBe(true);
  });

  it("refuses the handle, code, GST, business name and server-owned fields (R6, R8)", () => {
    for (const extra of [{ handle: "x" }, { code: "ORG-1" }, { gstNumber: "29ABCDE1234F1Z5" }, { businessName: "Pvt Ltd" }, { contactPerson: "John" }, { isActive: false }, { updatedAt: VERSION }]) {
      expect(shopContactSchema.safeParse({ name: "Noor Attar", ...extra, ...at }).success, Object.keys(extra)[0]).toBe(false);
    }
  });

  it("refuses a two-letter name and a bad number with the ux copy", () => {
    expect(shopContactSchema.safeParse({ name: "No", ...at }).error?.issues[0].message).toBe("Use at least 3 letters.");
    expect(shopContactSchema.safeParse({ phone: "12", ...at }).error?.issues[0].message).toBe(
      "Enter a valid phone number for the selected country",
    );
  });

  it("requires the version, and something to save (Q21)", () => {
    expect(shopContactSchema.safeParse({ name: "Noor Attar" }).success).toBe(false);
    expect(shopContactSchema.safeParse({ ...at }).success).toBe(false);
  });
});

describe("shopDetailsService.saveContact (Q23, Q25)", () => {
  const row = {
    updatedAt: new Date(VERSION),
    tagline: null, logoUrl: null, description: null, story: null, storyMergedAt: null, location: null, social: null,
    ownerName: null, ownerRole: null, ownerQuote: null, ownerPhotoUrl: null, returnsPreset: "STANDARD", promiseNote: null,
    deliveryPolicy: null, returnsPolicy: null,
    org: { handle: "noor-attar", name: "Noor Attar", phone: null, email: "new@example.com", updatedAt: new Date(NEWER) },
  };
  beforeEach(() => {
    h.findShopDetails.mockResolvedValue(row);
    h.updateContactIfUnchanged.mockResolvedValue({ outcome: "saved", previousEmail: null, phoneChange: null });
  });

  it("refuses staff with the ux copy and writes nothing (ux Refused)", async () => {
    await expect(
      shopDetailsService.saveContact("org_1", { userId: "u1", role: OrgRole.STAFF }, { name: "Renamed", ...at }),
    ).rejects.toMatchObject({ status: 403, message: SHOP_OWNER_ONLY });
    expect(h.updateContactIfUnchanged).not.toHaveBeenCalled();
  });

  it("writes only the fields sent, so a mobile save never rewrites the name or email", async () => {
    await shopDetailsService.saveContact("org_1", { userId: "u1", role: OrgRole.OWNER }, { phone: "+919800000000", ...at });
    expect(h.updateContactIfUnchanged).toHaveBeenCalledWith("org_1", new Date(VERSION), expect.anything());
    expect(h.updateContactIfUnchanged.mock.calls[0][2]).toStrictEqual({ phone: "+919800000000" });
    expect(h.recordAdminAction).not.toHaveBeenCalled();
  });

  it("audits an email change with the old and new address, by the owner who made it (ADR-0021)", async () => {
    h.updateContactIfUnchanged.mockResolvedValue({ outcome: "saved", previousEmail: "old@example.com", phoneChange: null });
    const saved = await shopDetailsService.saveContact("org_1", { userId: "u1", role: OrgRole.OWNER }, { email: "new@example.com", ...at });
    expect(h.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "u1", action: "ORG_EMAIL_CHANGED", resourceId: "org_1", metadata: { from: "old@example.com", to: "new@example.com" } }),
    );
    expect(saved.contactUpdatedAt).toBe(NEWER);
  });

  it("audits a mobile change with the old and new number (Q16)", async () => {
    h.updateContactIfUnchanged.mockResolvedValue({ outcome: "saved", previousEmail: null, phoneChange: { from: null } });
    await shopDetailsService.saveContact("org_1", { userId: "u1", role: OrgRole.OWNER }, { phone: "+919800000000", ...at });
    expect(h.recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "u1", action: "ORG_PHONE_CHANGED", resourceId: "org_1", metadata: { from: null, to: "+919800000000" } }),
    );
  });

  it("answers a stale version with the ux Stale copy (Q21)", async () => {
    h.updateContactIfUnchanged.mockResolvedValue({ outcome: "stale", updatedAt: new Date() });
    await expect(
      shopDetailsService.saveContact("org_1", { userId: "u1", role: OrgRole.OWNER }, { name: "Renamed", ...at }),
    ).rejects.toMatchObject({ status: 409, message: "Someone changed this 1 min ago. Load their version?" });
  });
});

describe("Shop details, private part (spec A2, R5, R6)", () => {
  beforeEach(() => {
    h.saveContact.mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("heads the private part and says buyers never see the mobile or email (spec A2)", () => {
    page();
    const part = document.getElementById("private-part") as HTMLElement;
    expect(within(part).getByText(SHOP_DETAILS_COPY.privatePart)).toBeInTheDocument();
    expect(within(part).getByText(FIELDS.phone.hint)).toBeInTheDocument();
    expect(within(part).getByText(FIELDS.email.hint)).toBeInTheDocument();
    expect(FIELDS.phone.hint).toMatch(/Buyers never see it/);
    expect(SHOP_DETAILS_COPY.privatePart).toMatch(/^Only Bhendi Bazaar sees this/);
  });

  it("shows the tax card and no tax fields (R6)", () => {
    page();
    expect(screen.getByText(SHOP_DETAILS_COPY.taxTitle)).toBeInTheDocument();
    expect(screen.getByText(SHOP_DETAILS_COPY.taxBody)).toBeInTheDocument();
    expect(screen.queryByLabelText(/GST|PAN|Business Name/i)).toBeNull();
  });

  it("shows the shop link with its warning and the change control (R5)", () => {
    page();
    expect(screen.getByText("/store/noor-attar")).toBeInTheDocument();
    expect(screen.getByText(FIELDS.link.hint)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change address" })).toBeEnabled();
  });

  it("saves a new mobile alone with the org's version and the ux toast (spec A3)", async () => {
    h.saveContact.mockResolvedValue({ ...shop, phone: "+919800000000", contactUpdatedAt: NEWER });
    page();
    fireEvent.change(screen.getByLabelText(FIELDS.phone.label), { target: { value: "98000 00000" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SHOP_DETAILS_COPY.save }));
    });
    await waitFor(() => expect(h.saveContact).toHaveBeenCalledTimes(1));
    expect(h.saveContact).toHaveBeenCalledWith("org_1", { phone: "+919800000000", expectedUpdatedAt: VERSION });
    expect(toast.success).toHaveBeenCalledWith(SHOP_DETAILS_COPY.phoneSaved);
  });

  it("shows a staff member the refusal on the section (ux Refused, Q23)", async () => {
    h.saveContact.mockRejectedValue(new ApiError(SHOP_OWNER_ONLY, 403));
    page();
    fireEvent.change(screen.getByLabelText(FIELDS.email.label), { target: { value: "orders@noor.in" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SHOP_DETAILS_COPY.save }));
    });
    expect(await screen.findByText(SHOP_OWNER_ONLY)).toBeInTheDocument();
  });
});

describe("the name change sheet (Q15)", () => {
  beforeEach(() => {
    h.saveContact.mockReset();
    vi.mocked(toast.success).mockReset();
  });

  const rename = async (name: string) => {
    fireEvent.change(screen.getByLabelText(FIELDS.name.label), { target: { value: name } });
    await act(async () => {
      fireEvent.submit(document.getElementById("shop-name") as HTMLFormElement);
    });
  };

  it("says where the new name shows and that the link stays, before writing anything (spec A3)", async () => {
    h.saveContact.mockResolvedValue({ ...shop, name: "Noor Attar", contactUpdatedAt: NEWER });
    page();
    await rename("Noor Attar");
    expect(
      await screen.findByText("Buyers will see Noor Attar on your shop and every product. Your link stays /store/noor-attar."),
    ).toBeInTheDocument();
    expect(h.saveContact).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: NAME_SHEET_COPY.change }));
    await waitFor(() => expect(h.saveContact).toHaveBeenCalledWith("org_1", { name: "Noor Attar", expectedUpdatedAt: VERSION }));
    expect(toast.success).toHaveBeenCalledWith(NAME_SHEET_COPY.changed);
  });

  it("keeps a two-letter name on the field and never opens the sheet (ux Terminal error)", async () => {
    page();
    await rename("No");
    expect(await screen.findByText("Use at least 3 letters.")).toBeInTheDocument();
    expect(screen.queryByText(NAME_SHEET_COPY.change)).toBeNull();
  });

  it("does not open the sheet for the name it already has", async () => {
    page();
    await rename(shop.name);
    expect(screen.queryByText(NAME_SHEET_COPY.change)).toBeNull();
  });

  it("clears the save bar when the new name only adds a trailing space (Q30)", async () => {
    page();
    await rename(`${shop.name} `);
    expect(screen.queryByText(NAME_SHEET_COPY.change)).toBeNull();
    expect(screen.queryByText(SHOP_DETAILS_COPY.unsaved)).toBeNull();
  });

  it("offers Try again in the sheet when the change never arrived (ux Retryable error)", async () => {
    h.saveContact.mockRejectedValue(new TypeError("Failed to fetch"));
    page();
    await rename("Noor Attar");
    fireEvent.click(await screen.findByRole("button", { name: NAME_SHEET_COPY.change }));
    expect(await screen.findByText(NAME_SHEET_COPY.retry)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: NAME_SHEET_COPY.tryAgain })).toBeEnabled();
  });

  it("shows staff the refusal with Close (ux Refused)", async () => {
    h.saveContact.mockRejectedValue(new ApiError(SHOP_OWNER_ONLY, 403));
    page();
    await rename("Noor Attar");
    fireEvent.click(await screen.findByRole("button", { name: NAME_SHEET_COPY.change }));
    expect(await screen.findByText(SHOP_OWNER_ONLY)).toBeInTheDocument();
    expect(screen.getByText(NAME_SHEET_COPY.close, { selector: "button" })).toBeEnabled();
  });

  it("answers a stale version in the sheet with Load latest, which reloads the page (Q21, ux Stale)", async () => {
    h.saveContact.mockRejectedValue(new ApiError("Someone changed this 2 min ago. Load their version?", 409));
    h.refresh.mockClear();
    page();
    await rename("Noor Attar");
    fireEvent.click(await screen.findByRole("button", { name: NAME_SHEET_COPY.change }));
    expect(await screen.findByText("Someone changed this 2 min ago. Load their version?")).toBeInTheDocument();
    expect(screen.queryByText(NAME_SHEET_COPY.close, { selector: "button" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: SHOP_DETAILS_COPY.loadLatest }));
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it("never disables Change name, says it is still changing after 3 s, and sends once (ADR-0053, ux Slow)", async () => {
    page();
    await rename("Noor Attar");
    const change = await screen.findByRole("button", { name: NAME_SHEET_COPY.change });
    vi.useFakeTimers();
    try {
      h.saveContact.mockReturnValue(new Promise(() => {}));
      await act(async () => {
        fireEvent.click(change);
      });
      expect(screen.getByRole("button", { name: NAME_SHEET_COPY.changing })).toBeEnabled();
      await act(async () => {
        vi.advanceTimersByTime(3100);
      });
      const still = screen.getByRole("button", { name: NAME_SHEET_COPY.stillChanging });
      expect(still).toBeEnabled();
      await act(async () => {
        fireEvent.click(still);
      });
      expect(h.saveContact).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the old-address notice (Q16, Q25)", () => {
  it("is sent once per job: the provider's idempotency key is the job id (ADR-0038 D4)", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.resetModules();
    h.send.mockResolvedValue({ data: { id: "e1" }, error: null });
    const { orgEmailChangedJob } = await import("@server/notifications/notifications.jobs");
    const payload = orgEmailChangedPayload.parse({ orgId: "org_1", shopName: "Noor Attar", oldEmail: "old@example.com" });
    await orgEmailChangedJob.handler({ jobId: "job-42", payload });
    await orgEmailChangedJob.handler({ jobId: "job-42", payload });
    expect(h.send).toHaveBeenCalledTimes(2);
    const keys = h.send.mock.calls.map((call) => call[1]?.idempotencyKey);
    expect(keys).toEqual(["org-email-changed/job-42", "org-email-changed/job-42"]);
    expect(h.send.mock.calls[0][0]).toMatchObject({
      to: "old@example.com",
      subject: expect.stringMatching(/^Your shop's email was changed/),
      // The notice says "reply to this email": a reply must reach someone who reads it.
      replyTo: SUPPORT_INBOX,
    });
  });
});
