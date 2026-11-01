/**
 * Shop details saves one section at a time, conditionally (org-profile U2; D3, D4; Q17, Q18, Q21).
 * Owns its fixtures: a migrated schema is all it needs.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("shop details (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orgRepository: typeof import("@server/catalog/org.repository").orgRepository;
  let shopDetailsService: typeof import("@server/catalog/shop-details.service").shopDetailsService;
  let storefrontService: typeof import("@server/catalog/storefront.service").storefrontService;
  const stamp = Date.now().toString(36);
  const handle = `details-test-${stamp}`;
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orgRepository } = await import("@server/catalog/org.repository"));
    ({ shopDetailsService } = await import("@server/catalog/shop-details.service"));
    ({ storefrontService } = await import("@server/catalog/storefront.service"));
    const org = await orgRepository.create({
      code: `DET-T${stamp}`.slice(0, 20),
      handle,
      name: `Details Test ${stamp}`,
      email: `details-${stamp}@example.invalid`,
      isActive: true,
      description: "Who we are.",
    });
    orgId = org.id;
    // A shop that wrote both halves and the old terms before this shipped (spec A5, Q19).
    await prisma.orgProfile.update({
      where: { orgId },
      data: {
        story: "How it began.",
        tagline: "Hand-made attar",
        location: "Bhendi Bazaar, Mumbai",
        ownerName: "Hussain Bhai",
        returnsPolicy: "Returns within 7 days.",
        pillars: [{ title: "Woven near by", text: "Three looms." }],
      },
    });
  });

  afterAll(async () => {
    await prisma.org.delete({ where: { id: orgId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
  });

  it("opens with the introduction and the longer story joined, and the buyer page reads the same (spec A5)", async () => {
    const details = await shopDetailsService.get(orgId);
    expect(details.about).toBe("Who we are.\n\nHow it began.");
    expect(details.aboutJoined).toBe(true);
    expect(details.oldReturnsPolicy).toBe("Returns within 7 days.");
    const page = await storefrontService.brandPage(handle);
    expect(page?.about).toBe("Who we are.\n\nHow it began.");
    expect(page?.returns).toEqual({ preset: "STANDARD", note: null });
    expect(JSON.stringify(page)).not.toContain("Returns within 7 days.");
  });

  it("saving one section leaves every other section intact (Q17)", async () => {
    const before = await shopDetailsService.get(orgId);
    const after = await shopDetailsService.saveSection(orgId, {
      section: "place",
      location: "Crawford Market, Mumbai",
      expectedUpdatedAt: before.updatedAt,
    });
    expect(after.location).toBe("Crawford Market, Mumbai");
    expect(after.tagline).toBe("Hand-made attar");
    expect(after.ownerName).toBe("Hussain Bhai");
    expect(after.about).toBe("Who we are.\n\nHow it began.");
    expect(after.updatedAt).not.toBe(before.updatedAt);
  });

  it("refuses a save carrying a version someone has since replaced, and writes nothing (Q21)", async () => {
    const before = await shopDetailsService.get(orgId);
    await shopDetailsService.saveSection(orgId, { section: "place", location: "First", expectedUpdatedAt: before.updatedAt });
    await expect(
      shopDetailsService.saveSection(orgId, { section: "place", location: "Second", expectedUpdatedAt: before.updatedAt }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/^Someone changed this \d+ min ago\. Load their version\?$/) });
    expect((await shopDetailsService.get(orgId)).location).toBe("First");
  });

  it("saving About writes the joined text once, keeps the old story, and buyers read only the saved words (D4, Q18)", async () => {
    const before = await shopDetailsService.get(orgId);
    const after = await shopDetailsService.saveSection(orgId, {
      section: "about",
      about: "Who we are, and how it began.",
      expectedUpdatedAt: before.updatedAt,
    });
    expect(after.about).toBe("Who we are, and how it began.");
    expect(after.aboutJoined).toBe(false);
    const row = await prisma.orgProfile.findUnique({ where: { orgId } }).then((r) => r!);
    expect(row.story).toBe("How it began.");
    expect(row.storyMergedAt).not.toBeNull();
    expect((await storefrontService.brandPage(handle))?.about).toBe("Who we are, and how it began.");
  });

  it("an all-blank section saves, and clears only its own columns (spec A6)", async () => {
    const before = await shopDetailsService.get(orgId);
    const after = await shopDetailsService.saveSection(orgId, {
      section: "person",
      ownerName: "",
      ownerRole: "",
      ownerQuote: "",
      ownerPhotoUrl: "",
      expectedUpdatedAt: before.updatedAt,
    });
    expect(after.ownerName).toBeNull();
    expect(after.tagline).toBe("Hand-made attar");
  });

  it("the promise section stores the preset and note; the buyer page carries them (D6)", async () => {
    const before = await shopDetailsService.get(orgId);
    await shopDetailsService.saveSection(orgId, {
      section: "promise",
      returnsPreset: "EXCHANGE_7_DAY",
      promiseNote: "Exchanges within a week.",
      expectedUpdatedAt: before.updatedAt,
    });
    expect((await storefrontService.brandPage(handle))?.returns).toEqual({ preset: "EXCHANGE_7_DAY", note: "Exchanges within a week." });
    const row = await prisma.orgProfile.findUnique({ where: { orgId } }).then((r) => r!);
    expect(row.returnsPolicy).toBe("Returns within 7 days.");
  });

  it("the narrowed storefront save writes looks and leaves every fact alone (D3)", async () => {
    userId = (await prisma.user.create({ data: { email: `details-editor-${stamp}@example.invalid` } })).id;
    const { updatedAt } = await storefrontService.getSettings(orgId);
    await storefrontService.saveSettings(orgId, userId, { expectedUpdatedAt: updatedAt, hiddenSections: ["social"] });
    const row = await prisma.orgProfile.findUnique({ where: { orgId } }).then((r) => r!);
    expect(row.hiddenSections).toEqual(["social"]);
    expect(row.tagline).toBe("Hand-made attar");
    expect(row.description).toBe("Who we are, and how it began.");
    expect(row.pillars).toEqual([{ title: "Woven near by", text: "Three looms." }]);
  });

  it("retires How you work: the text stays in its column and the buyer page never carries it (D5, Q6)", async () => {
    const page = await storefrontService.brandPage(handle);
    expect(page).not.toBeNull();
    expect(JSON.stringify(page)).not.toContain("Woven near by");
    const row = await prisma.orgProfile.findUnique({ where: { orgId } }).then((r) => r!);
    expect(row.pillars).toEqual([{ title: "Woven near by", text: "Three looms." }]);
  });
});
