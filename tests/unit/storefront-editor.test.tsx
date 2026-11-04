/**
 * The point-of-need editor (storefront-themes U6; D13; Q9, Q10, Q19, Q21, Q43, Q44, Q45; A4, A7).
 * The schema has no key a proof figure could arrive under and refuses a fourth claim in the ux's
 * words; a stored claim off the shop's list is dropped on read; every suggested product type has
 * a word and one theme; hours read in India; the preview alone draws "Add a photo" and the hidden
 * line; the sheet's Stale, Refused and Retryable states say what ux.md says.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { getSettings, saveSettings } = vi.hoisted(() => ({ getSettings: vi.fn(), saveSettings: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/org/orgStorefrontApiClient", () => ({ orgStorefrontApiClient: { getSettings, saveSettings } }));
vi.mock("@/components/support/contact-launcher", () => ({
  ContactLauncher: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { ApiError } from "@/lib/api-error";
import { CLAIMS_REFUSED, storefrontSettingsSchema } from "@/lib/validation/schemas/storefront.schema";
import { CLAIM, CLAIM_LABEL, SHOP_KINDS, claimsFor, readClaims } from "@server/catalog/storefront-claims";
import { hoursToday, readOpeningHours } from "@server/catalog/storefront-hours";
import {
  HIDEABLE_SECTIONS,
  SECTION,
  SECTION_FIELDS,
  THEME,
  THEME_KEYS,
  THEMES,
  suggestedTheme,
} from "@server/catalog/storefront-themes";
import { ThemedSections } from "@/components/storefront/themed/themed-sections";
import { themedPageData } from "@/components/storefront/themed/landing-data";
import { PREVIEW_COPY } from "@/components/storefront/preview/preview-copy";
import type { ThemedPageData } from "@/components/storefront/themed/page-data";
import type { StorefrontPage } from "@/data-access-layer/storefront.dal";
import type { StorefrontSettingsDto } from "@server/catalog/storefront.types";
import { SectionSheet } from "@/components/org/look/section-sheet";
import { SECTION_COPY } from "@/components/org/look/section-copy";

const at = "2026-11-01T10:00:00.000Z";

describe("the editor's schema (A7, Q21, ux.md section sheet)", () => {
  it("has no key for a proof figure: a typed rating, order count or dispatch time is refused (A7)", () => {
    for (const figure of ["rating", "ordersFulfilled", "proof", "dispatchDays", "reviewsCount", "since"]) {
      expect(storefrontSettingsSchema.safeParse({ expectedUpdatedAt: at, [figure]: 5 }).success, figure).toBe(false);
    }
  });

  it("refuses a fourth claim with the Refused copy, and the same claim twice", () => {
    const four = [CLAIM.HALLMARKED, CLAIM.GIFT_WRAP, CLAIM.CHECKED, CLAIM.FAMILY_RUN].map((key) => ({ key }));
    expect(storefrontSettingsSchema.safeParse({ expectedUpdatedAt: at, claims: four }).error?.issues[0].message).toBe(CLAIMS_REFUSED);
    const twice = [{ key: CLAIM.GIFT_WRAP }, { key: CLAIM.GIFT_WRAP }];
    expect(storefrontSettingsSchema.safeParse({ expectedUpdatedAt: at, claims: twice }).success).toBe(false);
  });

  it("words a too-long hero line as ux.md does, and needs the version it read", () => {
    const long = storefrontSettingsSchema.safeParse({ expectedUpdatedAt: at, heroLine: "x".repeat(121) });
    expect(long.error?.issues[0].message).toBe("Too long — 120 letters at most.");
    expect(storefrontSettingsSchema.safeParse({ heroLine: "Gold since 1952" }).success).toBe(false);
  });

  it("takes three hero photos and six collections, no more (Q10)", () => {
    const photo = (n: number) => `https://media.test/${n}.webp`;
    expect(storefrontSettingsSchema.safeParse({ expectedUpdatedAt: at, heroPhotos: [1, 2, 3, 4].map(photo) }).success).toBe(false);
    const collections = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ categoryId: `c${n}` }));
    expect(storefrontSettingsSchema.safeParse({ expectedUpdatedAt: at, collections }).success).toBe(false);
  });
});

describe("claims and suggestion are declared once (Q19, Q21, Q44)", () => {
  it("a stored claim off the shop's list is dropped on read, never shown unchecked (A7)", () => {
    const stored = [{ key: CLAIM.HALLMARKED, detail: "Card in the box" }, { key: CLAIM.ALCOHOL_FREE }, { key: "typed" }];
    expect(readClaims(stored, "jewellery")).toEqual([{ key: CLAIM.HALLMARKED, detail: "Card in the box" }]);
    expect(readClaims(stored, "fragrance")).toEqual([{ key: CLAIM.ALCOHOL_FREE, detail: null }]);
  });

  it("every shop can make the general claims; a kind adds its own first", () => {
    expect(claimsFor(null)).toEqual(claimsFor("unknown-type"));
    expect(claimsFor("jewellery").slice(0, 3)).toEqual(SHOP_KINDS.jewellery.claims);
    for (const kind of Object.values(SHOP_KINDS)) for (const key of kind.claims) expect(CLAIM_LABEL[key]).toBeTruthy();
  });

  it("each product type is suggested by one theme at most, and has a word for the badge", () => {
    const seen = THEME_KEYS.flatMap((theme) => THEMES[theme].suggestedFor);
    expect(new Set(seen).size).toBe(seen.length);
    for (const type of seen) expect(SHOP_KINDS[type]?.label, type).toBeTruthy();
    expect(suggestedTheme("jewellery")).toBe(THEME.DARBAR);
    expect(suggestedTheme(null)).toBeNull();
  });

  it("every hideable section has a sheet to show it again from (Q43)", () => {
    for (const section of HIDEABLE_SECTIONS) expect(section in SECTION_FIELDS, section).toBe(true);
  });
});

describe("opening hours (Q45)", () => {
  const hours = { open: "10:30", close: "21:00", closedDays: [5] };
  it("reads today's hours in India, closed days and all", () => {
    // 20:00 UTC on Thursday is already Friday 01:30 in India: a Friday-closed shop is shut.
    expect(hoursToday(hours, new Date("2026-11-05T20:00:00Z"))).toBeNull();
    expect(hoursToday(hours, new Date("2026-11-05T10:00:00Z"))).toBe("10:30 am – 9 pm");
  });

  it("reads a malformed value as none, so the line closes up", () => {
    expect(readOpeningHours({ open: "25:00", close: "21:00" })).toBeNull();
    expect(readOpeningHours("10-9")).toBeNull();
  });
});

const bare = (overrides: Partial<ThemedPageData> = {}): ThemedPageData => ({
  handle: "noor", name: "Noor Attar House", logoUrl: null, heroPhotos: [], heroLine: null, tagline: null,
  productCount: 0, bestSelling: [], newIn: [], offers: [], dealProducts: [], collections: [], proof: null,
  since: 2024, dispatchDays: null, returns: null, claims: [], about: "Who we are.", owner: null, reviews: null,
  area: null, hoursToday: null, hiddenSections: [], ...overrides,
});

describe("the preview draws what only its owner needs (ux.md preview: Empty; Q43)", () => {
  it("asks for a photo on an empty hero in the preview, never on a buyer's page", () => {
    const { rerender } = render(<ThemedSections theme={THEME.EDGE} page={bare()} preview />);
    expect(screen.getByText(PREVIEW_COPY.addPhoto)).toBeTruthy();
    rerender(<ThemedSections theme={THEME.EDGE} page={bare()} />);
    expect(screen.queryByText(PREVIEW_COPY.addPhoto)).toBeNull();
  });

  it("keeps a hidden section as a line to tap in the preview, and drops it for buyers", () => {
    const page = bare({ hiddenSections: [SECTION.STORY] });
    const { container, rerender } = render(<ThemedSections theme={THEME.EDGE} page={page} preview />);
    expect(container.querySelector(`[data-section="${SECTION.STORY}"]`)?.textContent).toBe(PREVIEW_COPY.hidden);
    rerender(<ThemedSections theme={THEME.EDGE} page={page} />);
    expect(container.querySelector(`[data-section="${SECTION.STORY}"]`)).toBeNull();
  });

  it("a cover from before the editor still fills the hero; categories, with the platform's photo, fill unpicked collections (Q11)", () => {
    const page = {
      handle: "noor", name: "N", logoUrl: null, heroUrl: "/cover.webp", heroPhotos: [], heroLine: null, tagline: null,
      collections: [], categories: [{ slug: "attar", name: "Attar", heroImage: "/attar.webp" }, { slug: "oud", name: "Oud", heroImage: "" }],
      themedHiddenSections: [], claims: [],
      openingHours: null,
    } as unknown as StorefrontPage;
    const data = themedPageData(page);
    expect(data.heroPhotos).toEqual(["/cover.webp"]);
    expect(data.collections).toEqual([
      { slug: "attar", name: "Attar", photoUrl: "/attar.webp" },
      { slug: "oud", name: "Oud", photoUrl: null },
    ]);
    const hidden = themedPageData({ ...page, themedHiddenSections: [SECTION.COLLECTIONS] } as StorefrontPage);
    expect(hidden.collections).toEqual([]);
  });
});

const settings = (overrides: Partial<StorefrontSettingsDto> = {}): StorefrontSettingsDto => ({
  handle: "noor", name: "Noor", heroUrl: null, hiddenSections: [], updatedAt: at, heroLine: null, heroPhotos: [], heroImages: [],
  collections: [], claims: [], openingHours: null, storefrontHiddenSections: [],
  claimOptions: claimsFor("jewellery").map((key) => ({ key, label: CLAIM_LABEL[key] })),
  categoryOptions: [], ...overrides,
});

describe("the section sheet (ux.md section sheet)", () => {
  beforeEach(() => {
    getSettings.mockReset();
    saveSettings.mockReset();
  });

  const sheet = (section: (typeof SECTION)[keyof typeof SECTION], onSaved = vi.fn()) =>
    render(<SectionSheet orgId="org_1" section={section} onClose={vi.fn()} onSaved={onSaved} />);

  it("asks only the section's own fields: the hero sheet has photos and a line, no claims", async () => {
    getSettings.mockResolvedValue(settings());
    sheet(SECTION.HERO);
    expect(await screen.findByText(SECTION_COPY.heroPhotosHelp)).toBeTruthy();
    expect(screen.getByLabelText(SECTION_COPY.heroLine)).toBeTruthy();
    expect(screen.queryByText(CLAIM_LABEL[CLAIM.HALLMARKED])).toBeNull();
  });

  it("a fourth claim is refused on tap with the button still live (Refused, Q21)", async () => {
    getSettings.mockResolvedValue(
      settings({ claims: [CLAIM.HALLMARKED, CLAIM.GIFT_WRAP, CLAIM.CHECKED].map((key) => ({ key, detail: null })) }),
    );
    sheet(SECTION.WHY_BUY);
    const fourth = await screen.findByRole("button", { name: CLAIM_LABEL[CLAIM.FAMILY_RUN] });
    expect(fourth).not.toBeDisabled();
    fireEvent.click(fourth);
    expect(screen.getByRole("alert").textContent).toBe(CLAIMS_REFUSED);
  });

  it("Stale: names who saved, loads theirs or resends mine at their version", async () => {
    getSettings.mockResolvedValue(settings());
    saveSettings.mockRejectedValueOnce(new ApiError("Changed by Ana just now. Load theirs?", 409));
    sheet(SECTION.HERO);
    fireEvent.change(await screen.findByLabelText(SECTION_COPY.heroLine), { target: { value: "Mine" } });
    fireEvent.click(screen.getByRole("button", { name: SECTION_COPY.save }));
    expect(await screen.findByText("Changed by Ana just now. Load theirs?")).toBeTruthy();
    expect(screen.getByRole("button", { name: SECTION_COPY.load })).toBeTruthy();

    const theirs = "2026-11-01T10:05:00.000Z";
    getSettings.mockResolvedValue(settings({ updatedAt: theirs, heroLine: "Theirs" }));
    saveSettings.mockResolvedValueOnce(settings());
    fireEvent.click(screen.getByRole("button", { name: SECTION_COPY.keepMine }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(2));
    const [, body] = saveSettings.mock.calls[1];
    expect(body).toMatchObject({ expectedUpdatedAt: theirs, heroLine: "Mine" });
    expect("claims" in body).toBe(false);
  });

  it("Retryable: a failed save keeps the words and says so", async () => {
    getSettings.mockResolvedValue(settings());
    saveSettings.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    sheet(SECTION.HERO);
    fireEvent.change(await screen.findByLabelText(SECTION_COPY.heroLine), { target: { value: "Kept" } });
    fireEvent.click(screen.getByRole("button", { name: SECTION_COPY.save }));
    expect(await screen.findByText(SECTION_COPY.saveFailed)).toBeTruthy();
    expect((screen.getByLabelText(SECTION_COPY.heroLine) as HTMLInputElement).value).toBe("Kept");
  });

  it("Long content: the counter shows from 80% of the limit", async () => {
    getSettings.mockResolvedValue(settings());
    sheet(SECTION.HERO);
    const line = await screen.findByLabelText(SECTION_COPY.heroLine);
    fireEvent.change(line, { target: { value: "x".repeat(95) } });
    expect(screen.queryByText("95 / 120")).toBeNull();
    fireEvent.change(line, { target: { value: "x".repeat(112) } });
    expect(await screen.findByText("112 / 120")).toBeTruthy();
  });
});
