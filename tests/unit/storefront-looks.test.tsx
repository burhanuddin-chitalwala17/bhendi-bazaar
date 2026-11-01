/**
 * Looks on the Shop page (org-profile U4; R7, A4; D5, D8; Q6, Q20).
 * "How you work" is retired from every input and from what buyers get, its text kept; the
 * accent, once four unnamed swatches, is no longer offered (storefront-themes D13).
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
  hiddenSections: [],
  updatedAt: "2026-11-01T10:00:00.000Z",
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

  it("no longer offers the accent: a theme's palettes replace it (storefront-themes D13)", () => {
    editor();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    const expectedUpdatedAt = settings.updatedAt;
    expect(storefrontSettingsSchema.safeParse({ expectedUpdatedAt, accent: "success" }).success).toBe(false);
  });

  it("saves at the version it read, with nothing about blocks or the accent", async () => {
    saveSettings.mockReset();
    saveSettings.mockResolvedValue({ updatedAt: settings.updatedAt });
    editor();
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    const [, body] = saveSettings.mock.calls[0];
    expect(body.expectedUpdatedAt).toBe(settings.updatedAt);
    expect("accent" in body).toBe(false);
    expect("pillars" in body).toBe(false);
  });

  it("saves twice in a row, the second at the version the first returned", async () => {
    saveSettings.mockReset();
    saveSettings.mockResolvedValueOnce({ updatedAt: "2026-11-01T10:05:00.000Z" });
    saveSettings.mockResolvedValueOnce({ updatedAt: "2026-11-01T10:06:00.000Z" });
    editor();
    const form = document.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled());
    fireEvent.submit(form);
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(2));
    expect(saveSettings.mock.calls[1][1].expectedUpdatedAt).toBe("2026-11-01T10:05:00.000Z");
  });
});
