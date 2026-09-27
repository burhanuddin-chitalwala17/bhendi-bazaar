/**
 * The request, and the two decisions (image-enhancement trd D1, D5, D8, ADR-0038 D2): every refusal
 * is a shown message and happens before anything is written; a granted request writes its row and
 * enqueues its job through the one transaction client; accepting registers the proposal as a
 * derived image through the catalog's seam and then decides the row; discarding deletes first so
 * nothing is left behind. The catalog and the queue are mocked — this is the domain's own logic.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { DEFAULT_MONTHLY_ALLOWANCE, ENHANCEMENT_DAILY_CAP_PAISE, type EnhancementRow } from "@server/content/enhancement.types";

const repo = {
  create: vi.fn(),
  findForOrg: vi.fn(),
  findById: vi.fn(),
  countUsage: vi.fn(),
  sumCostPaise: vi.fn(),
  markAccepted: vi.fn(),
  markDiscarded: vi.fn(),
};
const policies = { policyFor: vi.fn() };
const media = {
  findReadyImage: vi.fn(),
  readImageBytes: vi.fn(),
  putLooseObject: vi.fn(),
  deleteLooseObject: vi.fn(),
  registerDerivedObject: vi.fn(),
  publicUrlOf: (key: string) => `https://img.test/${key}`,
};
const tx = { marker: "the transaction client" };
const prisma = { $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
const enqueue = vi.fn();

vi.mock("@server/content/enhancement.repository", () => ({ enhancementRepository: repo }));
vi.mock("@server/content/enhancement-policy.repository", () => ({ enhancementPolicyRepository: policies }));
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: media }));
vi.mock("@server/shared/prisma", () => ({ prisma }));
vi.mock("@server/shared/jobs", () => ({ enqueue: (...args: unknown[]) => enqueue(...args) }));
vi.mock("@server/content/tools/light", () => ({ lightFix: vi.fn() }));

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

const request = (input = { tool: "LIGHT" as const, sourceRef: source.ref, slot: "front", slotRole: "product" }) =>
  enhancementService.request("org-1", "u1", input, now);

beforeEach(() => {
  vi.clearAllMocks();
  // These two take once-values and rejections in the cases below, which `clearAllMocks` keeps.
  repo.findForOrg.mockReset();
  media.deleteLooseObject.mockReset().mockResolvedValue(undefined);
  policies.policyFor.mockResolvedValue({ monthlyAllowance: DEFAULT_MONTHLY_ALLOWANCE, pausedAt: null, pauseReason: null });
  repo.countUsage.mockResolvedValue(3);
  repo.sumCostPaise.mockResolvedValue(0);
  media.findReadyImage.mockResolvedValue(source);
  repo.create.mockResolvedValue(row());
  enqueue.mockResolvedValue("job-1");
  repo.markAccepted.mockResolvedValue(true);
  repo.markDiscarded.mockResolvedValue(true);
  media.registerDerivedObject.mockResolvedValue({ id: "d1", ref: "https://img.test/products/o/a-light-e1.webp" });
});

describe("usage", () => {
  it("is this month's count against the org's policy, the defaults when it has no row", async () => {
    await expect(enhancementService.usage("org-1", now)).resolves.toEqual({
      used: 3,
      allowance: DEFAULT_MONTHLY_ALLOWANCE,
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
    expect(result.usage).toEqual({ used: 4, allowance: DEFAULT_MONTHLY_ALLOWANCE, paused: false, pauseReason: null });
  });

  it("resolves the photo by the URL the row carries, scoped to the org", async () => {
    await request();
    expect(media.findReadyImage).toHaveBeenCalledWith("org-1", { assetId: undefined, ref: source.ref });
  });

  it("refuses a paused shop with the reason, before any write", async () => {
    policies.policyFor.mockResolvedValue({ monthlyAllowance: 200, pausedAt: now, pauseReason: "Unpaid invoice" });
    await expect(request()).rejects.toThrow("Enhancement is paused for your shop: Unpaid invoice");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("refuses an org at its allowance, naming the number", async () => {
    repo.countUsage.mockResolvedValue(DEFAULT_MONTHLY_ALLOWANCE);
    await expect(request()).rejects.toThrow(`You have used all ${DEFAULT_MONTHLY_ALLOWANCE} enhancements for this month`);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses everyone once today's platform spend has reached the cap", async () => {
    repo.sumCostPaise.mockResolvedValue(ENHANCEMENT_DAILY_CAP_PAISE);
    await expect(request()).rejects.toThrow(/today's limit across the platform/);
    expect(repo.sumCostPaise).toHaveBeenCalledWith({ start: new Date("2026-09-27T00:00:00Z"), end: new Date("2026-09-28T00:00:00Z") });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses the label slot without reading anything", async () => {
    await expect(request({ tool: "LIGHT", sourceRef: source.ref, slot: "label", slotRole: "label" })).rejects.toThrow(/never enhanced/);
    expect(policies.policyFor).not.toHaveBeenCalled();
    expect(media.findReadyImage).not.toHaveBeenCalled();
  });

  it("refuses a tool that has no pipeline yet", async () => {
    await expect(request({ tool: "WHITE" as never, sourceRef: source.ref, slot: "front", slotRole: "product" })).rejects.toThrow(
      "On white is not available yet",
    );
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
