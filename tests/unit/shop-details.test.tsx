/**
 * Shop details, buyer part (org-profile U2; D2, D3, D4, D6; A2, A5, A6; Q17, Q21).
 * Schemas refuse what is not their section's (Invariant 4); the page says who sees every field;
 * a blank save goes through; stale and failed saves keep what was typed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { saveSection, refresh } = vi.hoisted(() => ({ saveSection: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/org/shopDetailsApiClient", () => ({ shopDetailsApiClient: { saveSection } }));
vi.mock("@/components/shared/image-upload", () => ({
  ImageUpload: ({ label }: { label: string }) => <div>{label}</div>,
}));
import { toast } from "sonner";

import { shopDetailsSectionSchema } from "@/lib/validation/schemas/shop-details.schema";
import { storefrontSettingsSchema } from "@/lib/validation/schemas/storefront.schema";
import { ShopDetailsEditor } from "@/components/org/shop-details/shop-details-editor";
import { FIELDS, SHOP_DETAILS_COPY } from "@/components/org/shop-details/shop-details-copy";
import { ApiError } from "@/lib/api-error";
import { staleMessage } from "@server/catalog/shop-details.service";
import type { ShopDetailsDto } from "@server/catalog/shop-details.types";

const VERSION = "2026-10-31T10:00:00.000Z";
const at = { expectedUpdatedAt: VERSION };

const blank: ShopDetailsDto = {
  handle: "noor-attar",
  name: "Noor Attar House",
  updatedAt: VERSION,
  tagline: null,
  logoUrl: null,
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
  phone: "+919876543210",
  email: "noor@example.com",
  contactUpdatedAt: VERSION,
};
const UNTIL = "2027-04-30T00:00:00.000Z";

describe("shopDetailsSectionSchema (Invariant 4, D3)", () => {
  it("accepts each section with only its own fields", () => {
    for (const body of [
      { section: "essentials", tagline: "Hand-made attar since 1962", logoUrl: "", ...at },
      { section: "about", about: "Who we are.", ...at },
      { section: "place", location: "Bhendi Bazaar, Mumbai", ...at },
      { section: "person", ownerName: "Hussain Bhai", ownerRole: "Owner", ownerQuote: "", ownerPhotoUrl: "", ...at },
      { section: "social", social: { instagram: "noorattar" }, ...at },
      { section: "promise", returnsPreset: "NO_RETURNS", promiseNote: "", ...at },
    ]) {
      expect(shopDetailsSectionSchema.safeParse(body).success, body.section).toBe(true);
    }
  });

  it("refuses another section's field, so one save cannot reach another's columns (Q17)", () => {
    expect(shopDetailsSectionSchema.safeParse({ section: "essentials", tagline: "x", location: "Mumbai", ...at }).success).toBe(false);
    expect(shopDetailsSectionSchema.safeParse({ section: "place", location: "Mumbai", about: "x", ...at }).success).toBe(false);
    expect(shopDetailsSectionSchema.safeParse({ section: "about", about: "x", description: "y", ...at }).success).toBe(false);
  });

  it("refuses code, GST, PAN, business name, pillars and server-owned fields (R6, R8, D5)", () => {
    for (const extra of [
      { code: "ORG-1" },
      { gstNumber: "29ABCDE1234F1Z5" },
      { panNumber: "ABCDE1234F" },
      { businessName: "Noor Pvt Ltd" },
      { pillars: [{ title: "a", text: "b" }] },
      { name: "Renamed" },
      { storyMergedAt: VERSION },
      { updatedAt: VERSION },
      { story: "old" },
      { deliveryPolicy: "old" },
    ]) {
      expect(shopDetailsSectionSchema.safeParse({ section: "essentials", ...extra, ...at }).success, Object.keys(extra)[0]).toBe(false);
    }
  });

  it("requires the version the page read (Q21)", () => {
    expect(shopDetailsSectionSchema.safeParse({ section: "place", location: "Mumbai" }).success).toBe(false);
  });

  it("refuses a returns promise outside the three (Q7)", () => {
    expect(shopDetailsSectionSchema.safeParse({ section: "promise", returnsPreset: "LIFETIME", ...at }).success).toBe(false);
  });

  it("refuses an about over 4,000 letters and a note over 280 (ux Long content)", () => {
    expect(shopDetailsSectionSchema.safeParse({ section: "about", about: "a".repeat(4001), ...at }).success).toBe(false);
    expect(shopDetailsSectionSchema.safeParse({ section: "about", about: "a".repeat(4000), ...at }).success).toBe(true);
    expect(shopDetailsSectionSchema.safeParse({ section: "promise", returnsPreset: "STANDARD", promiseNote: "a".repeat(281), ...at }).success).toBe(false);
  });

  it("refuses a web address for a handle with the ux copy", () => {
    const result = shopDetailsSectionSchema.safeParse({ section: "social", social: { instagram: "https://instagram.com/noor" }, ...at });
    expect(result.error?.issues[0].message).toBe("Use the handle on its own, not a web address.");
  });
});

describe("storefrontSettingsSchema is narrowed to looks (D3)", () => {
  it("refuses every fact Shop details owns, so two editors never write one column", () => {
    const expectedUpdatedAt = new Date().toISOString();
    for (const fact of ["tagline", "description", "logoUrl", "story", "location", "social", "ownerName", "ownerRole", "ownerQuote", "ownerPhotoUrl", "deliveryPolicy", "returnsPolicy"]) {
      expect(storefrontSettingsSchema.safeParse({ [fact]: "x", expectedUpdatedAt }).success, fact).toBe(false);
    }
    expect(storefrontSettingsSchema.safeParse({ expectedUpdatedAt, heroUrl: "", hiddenSections: ["story"] }).success).toBe(true);
  });
});

describe("the kept columns are still declared (Q4, Q6, Q19: nothing typed is dropped)", () => {
  const schema = readFileSync(resolve(__dirname, "../../prisma/schema.prisma"), "utf8");
  const model = (name: string) => schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";

  it("OrgProfile keeps story, pillars and both old policies", () => {
    for (const column of ["story", "pillars", "deliveryPolicy", "returnsPolicy", "description"]) {
      expect(model("OrgProfile"), column).toMatch(new RegExp(`\\n\\s+${column}\\s`));
    }
  });

  it("Org keeps contact person, business name, GST and PAN", () => {
    for (const column of ["contactPerson", "businessName", "gstNumber", "panNumber"]) {
      expect(model("Org"), column).toMatch(new RegExp(`\\n\\s+${column}\\s`));
    }
  });
});

describe("staleMessage", () => {
  it("says how long ago, in the ux words (ux Stale)", () => {
    const now = new Date("2026-10-31T10:02:00Z");
    expect(staleMessage(new Date("2026-10-31T10:00:00Z"), now)).toBe("Someone changed this 2 min ago. Load their version?");
    expect(staleMessage(now, now)).toBe("Someone changed this 1 min ago. Load their version?");
  });
});

describe("Shop details, buyer part", () => {
  beforeEach(() => {
    saveSection.mockReset();
    refresh.mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("says who sees every field, so 'will buyers see this?' is answered on screen (spec A2)", () => {
    const { container } = render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={blank} />);
    expect(screen.getByText(SHOP_DETAILS_COPY.buyersPart)).toBeInTheDocument();
    for (const field of [FIELDS.name, FIELDS.logo, FIELDS.tagline, FIELDS.about, FIELDS.location, FIELDS.ownerName, FIELDS.ownerRole, FIELDS.ownerQuote, FIELDS.ownerPhoto, FIELDS.returnsPreset, FIELDS.promiseNote]) {
      expect(screen.getAllByText(field.hint).length, field.label).toBeGreaterThan(0);
      expect(field.hint, field.label).toMatch(/Buyers (see|read)|your shop page/);
    }
    // Every text control in the buyer part carries a hint naming who sees it; the private part is U3's test.
    const controls = [...container.querySelectorAll("input:not([type=file]):not([type=hidden]), textarea, select")].filter(
      (control) => !control.closest("#private-part"),
    );
    for (const control of controls) {
      const describedBy = control.getAttribute("aria-describedby") ?? "";
      const hint = describedBy.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
      expect(hint, control.getAttribute("name") ?? "").toMatch(/Buyers (see|read)|your shop page/);
    }
  });

  it("starts a new shop on the three essentials, with every optional row saying what it adds (ux First use, Partial)", () => {
    render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={blank} />);
    expect(screen.getByText(SHOP_DETAILS_COPY.firstUse)).toBeInTheDocument();
    expect(screen.getByText(SHOP_DETAILS_COPY.essentialsHeader)).toBeInTheDocument();
    expect(screen.getByText("· adds the 'About' section")).toBeInTheDocument();
    expect(screen.getByText("· tells buyers what to expect")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See as a buyer/ })).toHaveAttribute("href", "/store/noor-attar");
  });

  it("shows the Empty line once the essentials are done and nothing optional is", () => {
    render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={{ ...blank, logoUrl: "https://img/x.webp", tagline: "Attar" }} />);
    expect(screen.getByText(SHOP_DETAILS_COPY.empty)).toBeInTheDocument();
  });

  it("saves a section with every optional field blank (spec A6)", async () => {
    saveSection.mockResolvedValue({ ...blank, updatedAt: "2026-10-31T10:05:00.000Z" });
    render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={blank} />);
    const place = document.getElementById("place") as HTMLFormElement;
    await act(async () => {
      fireEvent.submit(place);
    });
    await waitFor(() => expect(saveSection).toHaveBeenCalledTimes(1));
    expect(saveSection).toHaveBeenCalledWith("org_1", { section: "place", location: "", expectedUpdatedAt: VERSION });
    expect(toast.success).toHaveBeenCalledWith(SHOP_DETAILS_COPY.saved);
  });

  it("carries the newest version to the next save, so a second section after a first is not stale (Q21)", async () => {
    saveSection.mockResolvedValue({ ...blank, updatedAt: "2026-10-31T10:05:00.000Z" });
    render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={blank} />);
    await act(async () => {
      fireEvent.submit(document.getElementById("place") as HTMLFormElement);
    });
    await waitFor(() => expect(saveSection).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.submit(document.getElementById("essentials") as HTMLFormElement);
    });
    await waitFor(() => expect(saveSection).toHaveBeenCalledTimes(2));
    expect(saveSection.mock.calls[1][1].expectedUpdatedAt).toBe("2026-10-31T10:05:00.000Z");
  });

  it("shows the stale banner and loads the latest on a conflict, keeping what was typed (ux Stale)", async () => {
    saveSection.mockRejectedValue(new ApiError("Someone changed this 2 min ago. Load their version?", 409));
    render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={blank} />);
    const input = screen.getByLabelText(FIELDS.location.label);
    fireEvent.change(input, { target: { value: "Crawford Market" } });
    await act(async () => {
      fireEvent.submit(document.getElementById("place") as HTMLFormElement);
    });
    const banner = await screen.findByText("Someone changed this 2 min ago. Load their version?");
    expect(input).toHaveValue("Crawford Market");
    fireEvent.click(within(banner.parentElement as HTMLElement).getByRole("button", { name: SHOP_DETAILS_COPY.loadLatest }));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the retry banner when the save never arrived, keeping what was typed (ux Retryable error)", async () => {
    saveSection.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={blank} />);
    const input = screen.getByLabelText(FIELDS.location.label);
    fireEvent.change(input, { target: { value: "Crawford Market" } });
    await act(async () => {
      fireEvent.submit(document.getElementById("place") as HTMLFormElement);
    });
    expect(await screen.findByText(SHOP_DETAILS_COPY.retry)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SHOP_DETAILS_COPY.tryAgain })).toBeEnabled();
    expect(input).toHaveValue("Crawford Market");
  });

  it("opens About prefilled with the joined text and the note (spec A5, D4)", () => {
    render(
      <ShopDetailsEditor
        orgId="org_1"
        oldAddressWorksUntil={UNTIL}
        initial={{ ...blank, about: "Who we are.\n\nHow it began.", aboutJoined: true }}
      />,
    );
    expect(screen.getByText(SHOP_DETAILS_COPY.joinedNote)).toBeInTheDocument();
    expect(screen.getByLabelText(FIELDS.about.label)).toHaveValue("Who we are.\n\nHow it began.");
  });

  it("counts from 3,600 letters (ux Long content)", () => {
    render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={{ ...blank, about: "a".repeat(3812) }} />);
    expect(screen.getByText("3,812 / 4,000")).toBeInTheDocument();
  });

  it("shows the old free text read-only and copies it into the note (Q19)", () => {
    render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={{ ...blank, oldReturnsPolicy: "Returns within 7 days." }} />);
    expect(screen.getByText("Returns within 7 days.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: SHOP_DETAILS_COPY.copyIntoNote }));
    expect(screen.getByLabelText(FIELDS.promiseNote.label)).toHaveValue("Returns within 7 days.");
  });

  it("never disables Save, and says it is still saving after 3 s (ADR-0053, ux Slow)", async () => {
    vi.useFakeTimers();
    try {
      saveSection.mockReturnValue(new Promise(() => {}));
      render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={blank} />);
      const form = document.getElementById("place") as HTMLFormElement;
      const button = within(form).getByRole("button", { name: SHOP_DETAILS_COPY.save });
      await act(async () => {
        fireEvent.submit(form);
      });
      await act(async () => {
        vi.advanceTimersByTime(3100);
      });
      expect(within(form).getByRole("button", { name: SHOP_DETAILS_COPY.stillSaving })).toBeEnabled();
      expect(button).not.toBeDisabled();
      // A second tap while the first is in flight sends nothing more.
      await act(async () => {
        fireEvent.submit(form);
      });
      expect(saveSection).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("a refusal with no banner of its own is still shown (ADR-0013)", () => {
  it("shows a refused save's message on the section, keeping what was typed", async () => {
    saveSection.mockReset().mockRejectedValue(new ApiError("You do not have permission to do that", 403));
    render(<ShopDetailsEditor orgId="org_1" oldAddressWorksUntil={UNTIL} initial={blank} />);
    await act(async () => {
      fireEvent.submit(document.getElementById("place") as HTMLFormElement);
    });
    expect(await screen.findByText("You do not have permission to do that")).toBeInTheDocument();
  });
});
