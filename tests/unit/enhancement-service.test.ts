/**
 * The request, and the two decisions (image-enhancement trd D1, D5, D8, ADR-0038 D2): every refusal
 * is a shown message and happens before anything is written; a granted request writes its row and
 * enqueues its job through the one transaction client; accepting registers the proposal as a
 * derived image through the catalog's seam and then decides the row; discarding deletes first so
 * nothing is left behind. The catalog and the queue are mocked — this is the domain's own logic.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import {
  FALLBACK_DAILY_CAP_PAISE,
  FALLBACK_MONTHLY_ALLOWANCE,
  type EnhancementRow,
  type RequestEnhancementInput,
} from "@server/content/enhancement.types";

const repo = {
  countHostCutouts: vi.fn(),
  create: vi.fn(),
  findForOrg: vi.fn(),
  findById: vi.fn(),
  countUsage: vi.fn(),
  sumCostPaise: vi.fn(),
  markAccepted: vi.fn(),
  markDiscarded: vi.fn(),
  usageByOrg: vi.fn(),
};
const policies = { policyFor: vi.fn(), list: vi.fn(), save: vi.fn(), remove: vi.fn() };
const settings = { read: vi.fn(), save: vi.fn() };
const orgs = { summariesFor: vi.fn() };
const media = {
  findReadyImage: vi.fn(),
  readImageBytes: vi.fn(),
  putLooseObject: vi.fn(),
  deleteLooseObject: vi.fn(),
  registerDerivedObject: vi.fn(),
  publicUrlOf: (key: string) => `https://img.test/${key}`,
  publicBaseUrl: () => "https://img.test",
};
const segmenterFor = vi.fn();
const scenePainterFor = vi.fn();
const tx = { marker: "the transaction client" };
const prisma = { $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
const enqueue = vi.fn();

vi.mock("@server/content/enhancement.repository", () => ({ enhancementRepository: repo }));
const rateFor = vi.fn();
vi.mock("@server/content/generation/exchange-rate", () => ({ rateFor: (...args: unknown[]) => rateFor(...args) }));
vi.mock("@server/content/enhancement-policy.repository", () => ({ enhancementPolicyRepository: policies }));
vi.mock("@server/content/enhancement-settings.repository", () => ({ enhancementSettingsRepository: settings }));
vi.mock("@server/catalog/org.service", () => ({ adminOrgService: orgs }));
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: media }));
vi.mock("@server/shared/prisma", () => ({ prisma }));
// A paying shop: the lock itself is held by tests/integration/feature-enforcement.test.ts (feature-access A5).
vi.mock("@server/subscriptions/feature-access.service", () => ({ featureAccessService: { assert: async () => undefined } }));
vi.mock("@server/shared/jobs", () => ({ enqueue: (...args: unknown[]) => enqueue(...args) }));
vi.mock("@server/content/tools/light", () => ({ lightFix: vi.fn() }));
vi.mock("@server/content/tools/cutout", () => ({ cutOut: vi.fn() }));
vi.mock("@server/content/tools/white", () => ({ onWhite: vi.fn() }));
vi.mock("@server/content/tools/studio", () => ({ inStudio: vi.fn() }));
vi.mock("@server/content/tools/scene", () => ({ inScene: vi.fn() }));
vi.mock("@server/content/providers", () => ({
  segmenterFor: (...args: unknown[]) => segmenterFor(...args),
  scenePainterFor: (...args: unknown[]) => scenePainterFor(...args),
}));

const { enhancementService } = await import("@server/content/enhancement.service");

const now = new Date("2026-09-27T10:00:00Z");
const source = { id: "a1", ref: "https://img.test/products/o/a.webp", width: 1600, height: 1200 };

const row = (over: Partial<EnhancementRow> = {}): EnhancementRow => ({
  id: "e1",
  orgId: "org-1",
  requesterId: "u1",
  sourceAssetId: "a1",
  tool: "LIGHT",
  preset: null,
  provider: "sharp",
  state: "REQUESTED",
  slot: "front",
  proposalKey: null,
  resultAssetId: null,
  costPaise: 0,
  error: null,
  createdAt: now,
  proposedAt: null,
  decidedAt: null,
  sourceAsset: { ref: source.ref },
  resultAsset: null,
  ...over,
});
const proposed = () => row({ state: "PROPOSED", proposalKey: "proposals/e1.webp", proposedAt: now });

const request = (
  input: RequestEnhancementInput = { tool: "LIGHT", sourceRef: source.ref, slot: "front", slotRole: "product" },
) =>
  enhancementService.request("org-1", "u1", input, now);

beforeEach(() => {
  vi.clearAllMocks();
  // These two take once-values and rejections in the cases below, which `clearAllMocks` keeps.
  repo.findForOrg.mockReset();
  media.deleteLooseObject.mockReset().mockResolvedValue(undefined);
  // The ordinary shape of a fresh platform: no settings row, no org row — both layers deferring.
  settings.read.mockResolvedValue(null);
  policies.policyFor.mockResolvedValue({ monthlyAllowance: null, pausedAt: null, pauseReason: null });
  repo.countUsage.mockResolvedValue(3);
  repo.sumCostPaise.mockResolvedValue(0);
  media.findReadyImage.mockResolvedValue(source);
  repo.create.mockResolvedValue(row());
  enqueue.mockResolvedValue("job-1");
  repo.markAccepted.mockResolvedValue(true);
  repo.markDiscarded.mockResolvedValue(true);
  media.registerDerivedObject.mockResolvedValue({ id: "d1", ref: "https://img.test/products/o/a-light-e1.webp" });
  segmenterFor.mockReturnValue({ key: "zone", isAvailable: () => true, cutOut: vi.fn() });
  scenePainterFor.mockReturnValue({ key: "generation", isAvailable: () => true, paint: vi.fn() });
});

describe("usage", () => {
  it("is this month's count against the org's policy, the defaults when it has no row", async () => {
    await expect(enhancementService.usage("org-1", now)).resolves.toEqual({
      used: 3,
      allowance: FALLBACK_MONTHLY_ALLOWANCE,
      paused: false,
      pauseReason: null,
    });
    expect(repo.countUsage).toHaveBeenCalledWith("org-1", {
      start: new Date("2026-09-01T00:00:00Z"),
      end: new Date("2026-10-01T00:00:00Z"),
    });
  });
});

describe("request", () => {
  it("writes the row and enqueues the job through the one transaction, and answers with the usage after it", async () => {
    const result = await request();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(
      { orgId: "org-1", requesterId: "u1", sourceAssetId: "a1", tool: "LIGHT", preset: null, provider: "sharp", slot: "front" },
      tx,
    );
    expect(enqueue).toHaveBeenCalledWith(tx, expect.objectContaining({ type: "image.enhance" }), { enhancementId: "e1", orgId: "org-1" });
    expect(result.enhancement).toMatchObject({ id: "e1", state: "REQUESTED", sourceRef: source.ref, proposalUrl: null });
    expect(result.usage).toEqual({ used: 4, allowance: FALLBACK_MONTHLY_ALLOWANCE, paused: false, pauseReason: null });
  });

  it("resolves the photo by the URL the row carries, scoped to the org", async () => {
    await request();
    expect(media.findReadyImage).toHaveBeenCalledWith("org-1", { assetId: undefined, ref: source.ref });
  });

  it("refuses a paused shop with the reason, before any write", async () => {
    policies.policyFor.mockResolvedValue({ monthlyAllowance: null, pausedAt: now, pauseReason: "Unpaid invoice" });
    await expect(request()).rejects.toThrow("Enhancement is paused for your shop: Unpaid invoice");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("refuses an org at the allowance it resolved to, naming that number and not the constant", async () => {
    settings.read.mockResolvedValue({ defaultMonthlyAllowance: 400, dailyCapPaise: 50_000, updatedAt: now });
    policies.policyFor.mockResolvedValue({ monthlyAllowance: 25, pausedAt: null, pauseReason: null });
    repo.countUsage.mockResolvedValue(25);
    await expect(request()).rejects.toThrow("You have used all 25 enhancements for this month");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("names the platform's default where the org has no number of its own", async () => {
    settings.read.mockResolvedValue({ defaultMonthlyAllowance: 400, dailyCapPaise: 50_000, updatedAt: now });
    repo.countUsage.mockResolvedValue(400);
    await expect(request()).rejects.toThrow("You have used all 400 enhancements for this month");
  });

  it("refuses everyone once today's spend has reached the platform's cap, not the constant", async () => {
    // 20,000 paise is a cap the owner set; the fallback is 50,000. Reading the constant here
    // would let the platform spend ₹500 on a day the owner capped at ₹200.
    settings.read.mockResolvedValue({ defaultMonthlyAllowance: 300, dailyCapPaise: 20_000, updatedAt: now });
    repo.sumCostPaise.mockResolvedValue(20_000);
    await expect(request()).rejects.toThrow(/today's limit across the platform/);
    expect(repo.sumCostPaise).toHaveBeenCalledWith({ start: new Date("2026-09-27T00:00:00Z"), end: new Date("2026-09-28T00:00:00Z") });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("lets a request through at a spend the constant would have refused", async () => {
    settings.read.mockResolvedValue({ defaultMonthlyAllowance: 300, dailyCapPaise: 200_000, updatedAt: now });
    repo.sumCostPaise.mockResolvedValue(FALLBACK_DAILY_CAP_PAISE);
    await expect(request()).resolves.toMatchObject({ enhancement: { id: "e1" } });
  });

  it("refuses the label slot without reading anything", async () => {
    await expect(request({ tool: "LIGHT", sourceRef: source.ref, slot: "label", slotRole: "label" })).rejects.toThrow(/never enhanced/);
    expect(policies.policyFor).not.toHaveBeenCalled();
    expect(media.findReadyImage).not.toHaveBeenCalled();
  });

  it("refuses a tool the list no longer offers, naming none of them", async () => {
    await expect(request({ tool: "POLISH" as never, sourceRef: source.ref, slot: "front", slotRole: "product" })).rejects.toThrow(
      "That improvement is not available yet",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("records the service that will paint a scene, and the setting it was asked for", async () => {
    repo.create.mockResolvedValue(row({ tool: "SCENE", preset: "wooden-table", provider: "generation" }));

    await request({ tool: "SCENE", preset: "wooden-table", sourceRef: source.ref, slot: "front", slotRole: "product" });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "SCENE", preset: "wooden-table", provider: "generation" }),
      tx,
    );
  });

  it("refuses a scene before a slot is spent where nothing is set up to paint one", async () => {
    scenePainterFor.mockImplementation(() => {
      throw new DomainError("Scene backdrops are not set up yet");
    });
    await expect(
      request({ tool: "SCENE", preset: "wooden-table", sourceRef: source.ref, slot: "front", slotRole: "product" }),
    ).rejects.toThrow("Scene backdrops are not set up yet");
    expect(policies.policyFor).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a scene naming a setting that is not on the platform's list", async () => {
    // The boundary schema refuses this first; the service refuses it again, because a row read
    // back after a setting is retired is the same statement arriving by another road (spec R11).
    await expect(
      request({ tool: "SCENE", preset: "a beach in goa", sourceRef: source.ref, slot: "front", slotRole: "product" }),
    ).rejects.toThrow("Choose one of the scene settings");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("records the service a cutting tool will ask for, so the ledger says who was expected to run it", async () => {
    segmenterFor.mockReturnValue({ key: "model", isAvailable: () => true, cutOut: vi.fn() });
    repo.create.mockResolvedValue(row({ tool: "WHITE", provider: "model" }));

    await request({ tool: "WHITE", sourceRef: source.ref, slot: "front", slotRole: "product" });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ tool: "WHITE", provider: "model" }), tx);
  });

  it("refuses a cutting tool before a slot is spent where no service is set up for it", async () => {
    segmenterFor.mockImplementation(() => {
      throw new DomainError("Background removal is not set up yet");
    });
    await expect(request({ tool: "WHITE", sourceRef: source.ref, slot: "front", slotRole: "product" })).rejects.toThrow(
      "Background removal is not set up yet",
    );
    // Before the quota is even read: a run nobody can perform must not cost the shop a slot.
    expect(policies.policyFor).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("treats another org's photo, or one not ready, as not found", async () => {
    media.findReadyImage.mockResolvedValue(null);
    await expect(request()).rejects.toBeInstanceOf(NotFoundError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("get", () => {
  it("answers the org's own run and not another's", async () => {
    repo.findForOrg.mockResolvedValue(proposed());
    await expect(enhancementService.get("org-1", "e1")).resolves.toMatchObject({ state: "PROPOSED", proposalUrl: "https://img.test/proposals/e1.webp" });
    repo.findForOrg.mockResolvedValue(null);
    await expect(enhancementService.get("org-2", "e1")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("accept", () => {
  it("registers the proposal as a derived image carrying its making, decides the row, then drops the proposal object", async () => {
    const accepted = row({
      state: "ACCEPTED",
      proposalKey: "proposals/e1.webp",
      resultAssetId: "d1",
      resultAsset: { ref: "https://img.test/products/o/a-light-e1.webp" },
      decidedAt: now,
    });
    repo.findForOrg.mockResolvedValueOnce(proposed()).mockResolvedValueOnce(accepted);

    const result = await enhancementService.accept("org-1", "e1", now);

    expect(media.registerDerivedObject).toHaveBeenCalledWith({
      orgId: "org-1",
      uploaderId: "u1",
      sourceAssetId: "a1",
      fromKey: "proposals/e1.webp",
      fileSuffix: "light-e1.webp",
      contentType: "image/webp",
      transform: { tool: "LIGHT", preset: null, provider: "sharp", enhancementId: "e1" },
    });
    expect(repo.markAccepted).toHaveBeenCalledWith("e1", { resultAssetId: "d1", decidedAt: now });
    expect(media.deleteLooseObject).toHaveBeenCalledWith("proposals/e1.webp");
    expect(result).toMatchObject({ state: "ACCEPTED", resultRef: "https://img.test/products/o/a-light-e1.webp", proposalUrl: null });
    // The registration comes before the decision, so a decided row always names a real image.
    expect(media.registerDerivedObject.mock.invocationCallOrder[0]).toBeLessThan(repo.markAccepted.mock.invocationCallOrder[0]);
  });

  it("is refused when there is no proposal, and answers an already-kept run without registering twice", async () => {
    repo.findForOrg.mockResolvedValue(row({ state: "RUNNING" }));
    await expect(enhancementService.accept("org-1", "e1", now)).rejects.toBeInstanceOf(ConflictError);
    expect(media.registerDerivedObject).not.toHaveBeenCalled();

    repo.findForOrg.mockResolvedValue(row({ state: "ACCEPTED", resultAssetId: "d1", resultAsset: { ref: "https://img.test/x.webp" } }));
    await expect(enhancementService.accept("org-1", "e1", now)).resolves.toMatchObject({ state: "ACCEPTED" });
    expect(media.registerDerivedObject).not.toHaveBeenCalled();
  });

  it("refuses the second of two taps that raced, and deletes nothing for it", async () => {
    repo.findForOrg.mockResolvedValue(proposed());
    repo.markAccepted.mockResolvedValue(false);
    await expect(enhancementService.accept("org-1", "e1", now)).rejects.toThrow("already decided");
    expect(media.deleteLooseObject).not.toHaveBeenCalled();
  });

  it("does not fail the decision when the proposal object cannot be deleted afterwards", async () => {
    const accepted = row({ state: "ACCEPTED", resultAssetId: "d1", resultAsset: { ref: "https://img.test/x.webp" }, decidedAt: now });
    repo.findForOrg.mockResolvedValueOnce(proposed()).mockResolvedValueOnce(accepted);
    media.deleteLooseObject.mockRejectedValue(new Error("store refused the DELETE"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(enhancementService.accept("org-1", "e1", now)).resolves.toMatchObject({ state: "ACCEPTED" });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("discard", () => {
  it("deletes the proposal object first, then decides the row", async () => {
    repo.findForOrg.mockResolvedValueOnce(proposed()).mockResolvedValueOnce(row({ state: "DISCARDED", decidedAt: now }));
    const result = await enhancementService.discard("org-1", "e1", now);
    expect(media.deleteLooseObject).toHaveBeenCalledWith("proposals/e1.webp");
    expect(repo.markDiscarded).toHaveBeenCalledWith("e1", now);
    expect(media.deleteLooseObject.mock.invocationCallOrder[0]).toBeLessThan(repo.markDiscarded.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({ state: "DISCARDED", proposalUrl: null, resultRef: null });
  });

  it("is refused when there is no proposal, and is a no-op on a run already discarded", async () => {
    repo.findForOrg.mockResolvedValue(row({ state: "ACCEPTED" }));
    await expect(enhancementService.discard("org-1", "e1", now)).rejects.toBeInstanceOf(ConflictError);
    repo.findForOrg.mockResolvedValue(row({ state: "DISCARDED" }));
    await expect(enhancementService.discard("org-1", "e1", now)).resolves.toMatchObject({ state: "DISCARDED" });
    expect(media.deleteLooseObject).not.toHaveBeenCalled();
  });

  it("leaves the row proposed when the object could not be deleted, so the discard can be retried", async () => {
    repo.findForOrg.mockResolvedValue(proposed());
    media.deleteLooseObject.mockRejectedValue(new Error("store refused the DELETE"));
    await expect(enhancementService.discard("org-1", "e1", now)).rejects.toThrow("store refused the DELETE");
    expect(repo.markDiscarded).not.toHaveBeenCalled();
  });
});

describe("the platform's settings", () => {
  it("answers the fallbacks, and says nothing has been configured, while there is no row", async () => {
    await expect(enhancementService.settings()).resolves.toEqual({
      defaultMonthlyAllowance: FALLBACK_MONTHLY_ALLOWANCE,
      dailyCapPaise: FALLBACK_DAILY_CAP_PAISE,
      configured: false,
    });
  });

  it("answers the saved row once there is one", async () => {
    settings.read.mockResolvedValue({ defaultMonthlyAllowance: 120, dailyCapPaise: 30_000, updatedAt: now });
    await expect(enhancementService.settings()).resolves.toEqual({
      defaultMonthlyAllowance: 120,
      dailyCapPaise: 30_000,
      configured: true,
    });
  });

  it("saves through the one writer and reports what it now holds", async () => {
    settings.save.mockResolvedValue({ defaultMonthlyAllowance: 120, dailyCapPaise: 30_000, updatedAt: now });
    await expect(
      enhancementService.saveSettings({ defaultMonthlyAllowance: 120, dailyCapPaise: 30_000 }),
    ).resolves.toEqual({ defaultMonthlyAllowance: 120, dailyCapPaise: 30_000, configured: true });
    expect(settings.save).toHaveBeenCalledWith({ defaultMonthlyAllowance: 120, dailyCapPaise: 30_000 });
  });
});

describe("setOrgPolicy", () => {
  it("deletes the row when it would record nothing — no number of its own and not paused", async () => {
    await enhancementService.setOrgPolicy("org-1", { monthlyAllowance: null, paused: false, pauseReason: null }, now);
    expect(policies.remove).toHaveBeenCalledWith("org-1");
    expect(policies.save).not.toHaveBeenCalled();
  });

  it("writes a row for an allowance of the org's own", async () => {
    await enhancementService.setOrgPolicy("org-1", { monthlyAllowance: 25, paused: false, pauseReason: null }, now);
    expect(policies.save).toHaveBeenCalledWith("org-1", { monthlyAllowance: 25, pausedAt: null, pauseReason: null });
    expect(policies.remove).not.toHaveBeenCalled();
  });

  it("writes a row for a pause even where the allowance defers to the platform", async () => {
    await enhancementService.setOrgPolicy("org-1", { monthlyAllowance: null, paused: true, pauseReason: "Unpaid invoice" }, now);
    expect(policies.save).toHaveBeenCalledWith("org-1", {
      monthlyAllowance: null,
      pausedAt: now,
      pauseReason: "Unpaid invoice",
    });
  });

  it("keeps the moment a pause began when something else about the org is edited", async () => {
    const began = new Date("2026-09-01T09:00:00Z");
    policies.policyFor.mockResolvedValue({ monthlyAllowance: null, pausedAt: began, pauseReason: "Unpaid invoice" });
    await enhancementService.setOrgPolicy("org-1", { monthlyAllowance: 25, paused: true, pauseReason: "Unpaid invoice" }, now);
    expect(policies.save).toHaveBeenCalledWith("org-1", {
      monthlyAllowance: 25,
      pausedAt: began,
      pauseReason: "Unpaid invoice",
    });
  });

  it("drops the reason with the pause, so it cannot resurface on the next one", async () => {
    await enhancementService.setOrgPolicy("org-1", { monthlyAllowance: 25, paused: false, pauseReason: "Unpaid invoice" }, now);
    expect(policies.save).toHaveBeenCalledWith("org-1", { monthlyAllowance: 25, pausedAt: null, pauseReason: null });
  });
});

describe("listOrgUsage", () => {
  it("resolves each org's allowance, counts the month, and asks for every name in one call", async () => {
    settings.read.mockResolvedValue({ defaultMonthlyAllowance: 400, dailyCapPaise: 50_000, updatedAt: now });
    repo.usageByOrg.mockResolvedValue([
      { orgId: "org-1", used: 7, spentPaise: 1200 },
      { orgId: "org-2", used: 2, spentPaise: 0 },
    ]);
    policies.list.mockResolvedValue([
      { orgId: "org-2", monthlyAllowance: 25, pausedAt: null, pauseReason: null },
      { orgId: "org-3", monthlyAllowance: null, pausedAt: now, pauseReason: "Unpaid invoice" },
    ]);
    orgs.summariesFor.mockResolvedValue([
      { id: "org-1", name: "Anwar Cloth", code: "ORG-1" },
      { id: "org-2", name: "Bohra Hardware", code: "ORG-2" },
      { id: "org-3", name: "Crawford Spices", code: "ORG-3" },
    ]);

    const rows = await enhancementService.listOrgUsage({ month: now });

    expect(repo.usageByOrg).toHaveBeenCalledWith({
      start: new Date("2026-09-01T00:00:00Z"),
      end: new Date("2026-10-01T00:00:00Z"),
    });
    // One call for every name, whatever the row count: a listing must not be a query per org.
    expect(orgs.summariesFor).toHaveBeenCalledTimes(1);
    expect(orgs.summariesFor).toHaveBeenCalledWith(["org-1", "org-2", "org-3"]);
    expect(rows).toEqual([
      {
        orgId: "org-1",
        name: "Anwar Cloth",
        code: "ORG-1",
        used: 7,
        spentPaise: 1200,
        monthlyAllowance: 400,
        monthlyAllowanceOverride: null,
        paused: false,
        pauseReason: null,
      },
      {
        orgId: "org-2",
        name: "Bohra Hardware",
        code: "ORG-2",
        used: 2,
        spentPaise: 0,
        monthlyAllowance: 25,
        monthlyAllowanceOverride: 25,
        paused: false,
        pauseReason: null,
      },
      {
        orgId: "org-3",
        name: "Crawford Spices",
        code: "ORG-3",
        used: 0,
        spentPaise: 0,
        monthlyAllowance: 400,
        monthlyAllowanceOverride: null,
        paused: true,
        pauseReason: "Unpaid invoice",
      },
    ]);
  });

  it("is empty when nobody has enhanced anything and nobody has a rule of their own", async () => {
    repo.usageByOrg.mockResolvedValue([]);
    policies.list.mockResolvedValue([]);
    orgs.summariesFor.mockResolvedValue([]);
    await expect(enhancementService.listOrgUsage({ month: now })).resolves.toEqual([]);
    expect(orgs.summariesFor).toHaveBeenCalledWith([]);
  });
});

describe("platformSpendToday", () => {
  it("sums the UTC day the cap is read against", async () => {
    repo.sumCostPaise.mockResolvedValue(4200);
    await expect(enhancementService.platformSpendToday(now)).resolves.toBe(4200);
    expect(repo.sumCostPaise).toHaveBeenCalledWith({
      start: new Date("2026-09-27T00:00:00Z"),
      end: new Date("2026-09-28T00:00:00Z"),
    });
  });
});

describe("what the free tools cost the platform (ai-images Q16; generation-foundation D11)", () => {
  it("is nothing within the host's free allowance, and asks for no rate", async () => {
    repo.countHostCutouts.mockResolvedValue(4_999);
    await expect(enhancementService.absorbedThisMonth(now)).resolves.toEqual({ cutouts: 4_999, over: 0, paise: 0 });
    expect(rateFor).not.toHaveBeenCalled();
  });

  it("prices each cut-out past it at the overage, at the day's rate, rounded up", async () => {
    repo.countHostCutouts.mockResolvedValue(5_003);
    rateFor.mockResolvedValue({ day: now, paisePerUsd: 9_340 });
    // 3 × $0.0005 at ₹93.40 is 14.01 paise: the platform spent 15.
    await expect(enhancementService.absorbedThisMonth(now)).resolves.toEqual({ cutouts: 5_003, over: 3, paise: 15 });
    expect(repo.countHostCutouts).toHaveBeenCalledWith(expect.anything(), ["CUTOUT", "WHITE", "STUDIO", "SCENE"], "model");
  });

  it("shows the count without a price when no rate was ever stored", async () => {
    repo.countHostCutouts.mockResolvedValue(6_000);
    rateFor.mockResolvedValue(null);
    await expect(enhancementService.absorbedThisMonth(now)).resolves.toEqual({ cutouts: 6_000, over: 1_000, paise: null });
  });
});
