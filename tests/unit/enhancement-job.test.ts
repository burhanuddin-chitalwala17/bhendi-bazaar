/**
 * The run as the worker performs it (image-enhancement trd D2, D9; ADR-0038 D4): a row past RUNNING
 * is left alone, a REQUESTED or RUNNING one is taken, the tool runs on the source's bytes, the
 * proposal lands under its own key and the row is proposed with its cost; a refusal fails the row
 * with its message, and any other error reaches the queue. The tool and the catalog seam are mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
import type { EnhancementRow } from "@server/content/enhancement.types";

const repo = {
  findById: vi.fn(),
  markRunning: vi.fn(),
  markProposed: vi.fn(),
  markFailed: vi.fn(),
};
const media = {
  readImageBytes: vi.fn(),
  putLooseObject: vi.fn(),
  publicUrlOf: (key: string) => `https://img.test/${key}`,
  publicBaseUrl: () => "https://img.test",
};
const lightFix = vi.fn();
const cutOut = vi.fn();
const inScene = vi.fn();
const segmenterFor = vi.fn();
const scenePainterFor = vi.fn();

vi.mock("@server/content/enhancement.repository", () => ({ enhancementRepository: repo }));
vi.mock("@server/content/enhancement-policy.repository", () => ({ enhancementPolicyRepository: {} }));
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: media }));
vi.mock("@server/shared/prisma", () => ({ prisma: {} }));
vi.mock("@server/shared/jobs", () => ({
  enqueue: vi.fn(),
  registerJob: <T,>(definition: T) => definition,
}));
vi.mock("@server/content/tools/light", () => ({ lightFix: (...args: unknown[]) => lightFix(...args) }));
vi.mock("@server/content/tools/cutout", () => ({ cutOut: (...args: unknown[]) => cutOut(...args) }));
vi.mock("@server/content/tools/white", () => ({ onWhite: vi.fn() }));
vi.mock("@server/content/tools/studio", () => ({ inStudio: vi.fn() }));
vi.mock("@server/content/tools/scene", () => ({ inScene: (...args: unknown[]) => inScene(...args) }));
vi.mock("@server/content/providers", () => ({
  segmenterFor: (...args: unknown[]) => segmenterFor(...args),
  scenePainterFor: (...args: unknown[]) => scenePainterFor(...args),
}));

const { imageEnhanceJob } = await import("@server/content/enhancement.jobs");

const requested: EnhancementRow = {
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
  createdAt: new Date("2026-09-27T10:00:00Z"),
  proposedAt: null,
  decidedAt: null,
  sourceAsset: { ref: "https://img.test/products/o/a.webp" },
  resultAsset: null,
};
const output = Buffer.from("improved bytes");

const run = () => imageEnhanceJob.handler({ jobId: "job-1", payload: { enhancementId: "e1", orgId: "org-1" } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  repo.findById.mockResolvedValue(requested);
  repo.markRunning.mockResolvedValue(true);
  repo.markProposed.mockResolvedValue(true);
  repo.markFailed.mockResolvedValue(true);
  media.readImageBytes.mockResolvedValue({
    bytes: Buffer.from("source bytes"),
    objectKey: "products/org-1/a.webp",
    mimeType: "image/webp",
  });
  media.putLooseObject.mockResolvedValue("https://img.test/proposals/e1.webp");
  lightFix.mockResolvedValue({ output, mimeType: "image/webp", width: 1600, height: 1200 });
  cutOut.mockResolvedValue({ output, mimeType: "image/png", width: 900, height: 900 });
  inScene.mockResolvedValue({ output, mimeType: "image/webp", width: 1200, height: 1200 });
  segmenterFor.mockReturnValue({ key: "model", isAvailable: () => true, cutOut: vi.fn() });
  scenePainterFor.mockReturnValue({ key: "model", isAvailable: () => true, paint: vi.fn() });
});

describe("image.enhance", () => {
  it("is registered under its name and grouped by org", () => {
    expect(imageEnhanceJob.type).toBe("image.enhance");
    expect(imageEnhanceJob.group?.({ enhancementId: "e1", orgId: "org-1" })).toBe("org-1");
  });

  it("takes a requested row, runs the tool on the source, stores the proposal and marks it proposed at no cost", async () => {
    await run();

    expect(repo.markRunning).toHaveBeenCalledWith("e1");
    expect(media.readImageBytes).toHaveBeenCalledWith("a1");
    expect(lightFix).toHaveBeenCalledWith(Buffer.from("source bytes"));
    expect(media.putLooseObject).toHaveBeenCalledWith("proposals/e1.webp", output, "image/webp");
    expect(repo.markProposed).toHaveBeenCalledWith("e1", {
      proposalKey: "proposals/e1.webp",
      provider: "sharp",
      costPaise: 0,
      proposedAt: expect.any(Date),
    });
    // A tool that asks no service for anything never goes looking for one.
    expect(segmenterFor).not.toHaveBeenCalled();
    expect(repo.markFailed).not.toHaveBeenCalled();
    // The order is the guard: the row is taken before any bytes move, and proposed only after they have.
    expect(repo.markRunning.mock.invocationCallOrder[0]).toBeLessThan(media.readImageBytes.mock.invocationCallOrder[0]);
    expect(media.putLooseObject.mock.invocationCallOrder[0]).toBeLessThan(repo.markProposed.mock.invocationCallOrder[0]);
  });

  it("leaves a row already proposed, decided or failed alone — a redelivered job does nothing", async () => {
    for (const state of ["PROPOSED", "ACCEPTED", "DISCARDED", "FAILED"] as const) {
      repo.findById.mockResolvedValue({ ...requested, state });
      await run();
    }
    expect(repo.markRunning).not.toHaveBeenCalled();
    expect(media.readImageBytes).not.toHaveBeenCalled();
    expect(lightFix).not.toHaveBeenCalled();
  });

  it("resumes a row a dead worker left RUNNING, since the tool is deterministic and the key fixed", async () => {
    repo.findById.mockResolvedValue({ ...requested, state: "RUNNING" });
    await run();
    expect(repo.markRunning).toHaveBeenCalledWith("e1");
    expect(repo.markProposed).toHaveBeenCalledTimes(1);
  });

  it("does nothing further when the row moved under it", async () => {
    repo.markRunning.mockResolvedValue(false);
    await run();
    expect(media.readImageBytes).not.toHaveBeenCalled();
    expect(repo.markProposed).not.toHaveBeenCalled();
  });

  it("fails the row with the reason when the source is gone, and stores nothing", async () => {
    media.readImageBytes.mockRejectedValue(new NotFoundError("Photo not found"));
    await run();
    expect(repo.markFailed).toHaveBeenCalledWith("e1", "Photo not found");
    expect(media.putLooseObject).not.toHaveBeenCalled();
    expect(repo.markProposed).not.toHaveBeenCalled();
  });

  it("fails a row whose tool the list no longer offers, naming none of them", async () => {
    // All six have a pipeline today, so this is a row the database kept after a tool was
    // withdrawn — which the worker must refuse rather than run with nothing to run.
    repo.findById.mockResolvedValue({ ...requested, tool: "POLISH" as EnhancementRow["tool"] });
    await run();
    expect(repo.markFailed).toHaveBeenCalledWith("e1", "That improvement is not available yet");
    expect(media.readImageBytes).not.toHaveBeenCalled();
  });

  it("runs a scene through both services and charges the cut-out and the paint together", async () => {
    // The cut-out came from the paid model here, so this run bought two things (trd D6).
    repo.findById.mockResolvedValue({ ...requested, tool: "SCENE", preset: "wooden-table", provider: "model" });
    await run();

    expect(inScene).toHaveBeenCalledWith(
      { bytes: Buffer.from("source bytes"), objectKey: "products/org-1/a.webp", mimeType: "image/webp" },
      expect.objectContaining({ key: "model" }),
      expect.objectContaining({ key: "model" }),
      expect.objectContaining({ key: "wooden-table", aspect: "square" }),
    );
    expect(repo.markProposed).toHaveBeenCalledWith("e1", {
      proposalKey: "proposals/e1.webp",
      // The ledger records the service that painted; the cost is everything the run spent.
      provider: "model",
      costPaise: 350 + 18,
      proposedAt: expect.any(Date),
    });
  });

  it("charges a scene for the paint alone where the cut-out came from the free transform", async () => {
    segmenterFor.mockReturnValue({ key: "zone", isAvailable: () => true, cutOut: vi.fn() });
    repo.findById.mockResolvedValue({ ...requested, tool: "SCENE", preset: "shop-shelf", provider: "model" });
    await run();
    expect(repo.markProposed).toHaveBeenCalledWith("e1", expect.objectContaining({ provider: "model", costPaise: 350 }));
  });

  it("fails a scene whose setting the list no longer has, before any bytes are read", async () => {
    repo.findById.mockResolvedValue({ ...requested, tool: "SCENE", preset: "a beach in goa" });
    await run();
    expect(repo.markFailed).toHaveBeenCalledWith("e1", "Choose one of the scene settings");
    expect(media.readImageBytes).not.toHaveBeenCalled();
  });

  it("fails a scene where no service is set up to paint one", async () => {
    scenePainterFor.mockImplementation(() => {
      throw new DomainError("Scene backdrops are not set up yet");
    });
    repo.findById.mockResolvedValue({ ...requested, tool: "SCENE", preset: "wooden-table" });
    await run();
    expect(repo.markFailed).toHaveBeenCalledWith("e1", "Scene backdrops are not set up yet");
    expect(media.readImageBytes).not.toHaveBeenCalled();
  });

  it("records the service that actually cut the product out, and what it charged", async () => {
    repo.findById.mockResolvedValue({ ...requested, tool: "CUTOUT", provider: "zone" });
    await run();

    expect(cutOut).toHaveBeenCalledWith(
      { bytes: Buffer.from("source bytes"), objectKey: "products/org-1/a.webp", mimeType: "image/webp" },
      expect.objectContaining({ key: "model" }),
    );
    // The key carries the format the tool writes, and the ledger the service that ran — which is
    // the one the worker found, not the one the request planned for.
    expect(media.putLooseObject).toHaveBeenCalledWith("proposals/e1.png", output, "image/png");
    expect(repo.markProposed).toHaveBeenCalledWith("e1", {
      proposalKey: "proposals/e1.png",
      provider: "model",
      costPaise: 18,
      proposedAt: expect.any(Date),
    });
  });

  it("fails the row, and reads no bytes, where no service is set up to cut anything out", async () => {
    repo.findById.mockResolvedValue({ ...requested, tool: "CUTOUT" });
    segmenterFor.mockImplementation(() => {
      throw new DomainError("Background removal is not set up yet");
    });
    await run();
    expect(repo.markFailed).toHaveBeenCalledWith("e1", "Background removal is not set up yet");
    expect(media.readImageBytes).not.toHaveBeenCalled();
  });

  it("treats a refusal from the tool itself the same way", async () => {
    lightFix.mockRejectedValue(new DomainError("This file is not an image we can read"));
    await run();
    expect(repo.markFailed).toHaveBeenCalledWith("e1", "This file is not an image we can read");
  });

  it("lets any other failure reach the queue, with the row still taken and nothing proposed or failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    media.putLooseObject.mockRejectedValue(new Error("store refused the PUT"));
    await expect(run()).rejects.toThrow("store refused the PUT");
    expect(repo.markProposed).not.toHaveBeenCalled();
    expect(repo.markFailed).not.toHaveBeenCalled();
  });
});
