/**
 * Looks on the Shop page (org-profile U4; R7, A4; D5, D8; Q6, Q20).
 * "How you work" is retired from every input and from what buyers get, its text kept; the
 * accent is four unnamed swatches labelled "Colour", so no token name reaches a shop.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { saveSettings } = vi.hoisted(() => ({ saveSettings: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/org/orgStorefrontApiClient", () => ({
  orgStorefrontApiClient: { saveSettings, changeHandle: vi.fn() },
}));
vi.mock("@/components/shared/image-upload", () => ({
  ImageUpload: ({ label }: { label: string }) => <div>{label}</div>,
}));

import { StorefrontEditor } from "@/components/org/storefront-editor";
import {
  STOREFRONT_ACCENTS,
  storefrontSettingsSchema,
} from "@/lib/validation/schemas/storefront.schema";
import { toBrandPageDto } from "@server/catalog/storefront.types";
import { PUBLIC_PROFILE_SELECT } from "@server/catalog/org-profile.repository";
import {
  BRAND_PAGE_SECTION_ORDER,
  HIDEABLE_BRAND_PAGE_SECTIONS,
  hiddenSectionsFrom,
} from "@server/catalog/brand-page-sections";

const settings = {
  handle: "noor-attar",
  name: "Noor Attar House",
  heroUrl: null,
  accent: "info",
  hiddenSections: [],
};

const editor = () =>
  render(<StorefrontEditor orgId="org_1" settings={settings} oldAddressWorksUntil="2026-12-01T00:00:00.000Z" />);

describe("How you work is retired, its text kept (D5, Q6)", () => {
  it("the looks schema refuses pillars, so no save can write them", () => {
    const result = storefrontSettingsSchema.safeParse({ pillars: [{ title: "Woven near by", text: "Three looms." }] });
    expect(result.success).toBe(false);
  });

  it("buyers never get the blocks, even with text in the column", () => {
    expect("pillars" in PUBLIC_PROFILE_SELECT).toBe(false);
    const page = toBrandPageDto(
      {
        tagline: null, description: null, story: null, storyMergedAt: null, location: null,
        logoUrl: null, heroUrl: null, accent: null, returnsPreset: "STANDARD", promiseNote: null,
        social: null, ownerName: null, ownerRole: null, ownerQuote: null, ownerPhotoUrl: null,
        hiddenSections: null,
        // What a row from before this unit still holds; the read must not carry it.
        ...({ pillars: [{ title: "Woven near by", text: "Three looms." }] } as object),
        org: { id: "o", handle: "h", name: "N", joinedAt: new Date("2021-01-01") },
      },
      [],
      { proof: null, buyersSay: null },
    );
    expect("pillars" in page).toBe(false);
    expect(JSON.stringify(page)).not.toContain("Woven near by");
  });

  it("is no longer a section, nor one a shop can hide; an old hidden key is dropped", () => {
    expect(BRAND_PAGE_SECTION_ORDER as readonly string[]).not.toContain("pillars");
    expect(HIDEABLE_BRAND_PAGE_SECTIONS as readonly string[]).not.toContain("pillars");
    expect(hiddenSectionsFrom(["pillars", "story"])).toEqual(["story"]);
  });
});

describe("the Shop page shows looks without token names (D8, A4, Q20)", () => {
  it("says none of Accent, Block or How you work (spec A4)", () => {
    const { container } = editor();
    const text = container.textContent ?? "";
    for (const word of ["Accent", "Block 1", "How you work", ...STOREFRONT_ACCENTS]) {
      expect(text, word).not.toContain(word);
    }
    expect(container.querySelector("#pillars")).toBeNull();
  });

  it("offers the four existing values as unnamed swatches labelled Colour", () => {
    editor();
    const group = screen.getByRole("radiogroup", { name: "Colour" });
    const swatches = screen.getAllByRole("radio");
    expect(swatches).toHaveLength(STOREFRONT_ACCENTS.length);
    for (const swatch of swatches) {
      expect(group.contains(swatch)).toBe(true);
      const name = swatch.getAttribute("aria-label") ?? "";
      for (const token of STOREFRONT_ACCENTS) expect(name.toLowerCase()).not.toContain(token);
      expect(swatch).not.toBeDisabled();
    }
    expect(swatches.filter((s) => s.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(swatches[STOREFRONT_ACCENTS.indexOf("info")]).toHaveAttribute("aria-checked", "true");
  });

  it("saves the swatch picked, and nothing about blocks", async () => {
    saveSettings.mockResolvedValue({});
    editor();
    const swatches = screen.getAllByRole("radio");
    fireEvent.click(swatches[STOREFRONT_ACCENTS.indexOf("success")]);
    expect(swatches[STOREFRONT_ACCENTS.indexOf("success")]).toHaveAttribute("aria-checked", "true");
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    const [, body] = saveSettings.mock.calls[0];
    expect(body.accent).toBe("success");
    expect("pillars" in body).toBe(false);
  });
});
