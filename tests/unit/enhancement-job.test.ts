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
};
const lightFix = vi.fn();

vi.mock("@server/content/enhancement.repository", () => ({ enhancementRepository: repo }));
vi.mock("@server/content/enhancement-policy.repository", () => ({ enhancementPolicyRepository: {} }));
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: media }));
vi.mock("@server/shared/prisma", () => ({ prisma: {} }));
vi.mock("@server/shared/jobs", () => ({
  enqueue: vi.fn(),
  registerJob: <T,>(definition: T) => definition,
}));
vi.mock("@server/content/tools/light", () => ({ lightFix: (...args: unknown[]) => lightFix(...args) }));

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
  media.readImageBytes.mockResolvedValue({ bytes: Buffer.from("source bytes"), mimeType: "image/webp" });
  media.putLooseObject.mockResolvedValue("https://img.test/proposals/e1.webp");
  lightFix.mockResolvedValue({ output, mimeType: "image/webp", width: 1600, height: 1200 });
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
    expect(repo.markProposed).toHaveBeenCalledWith("e1", { proposalKey: "proposals/e1.webp", costPaise: 0, proposedAt: expect.any(Date) });
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

  it("fails a row whose tool has no pipeline yet, in the org member's words", async () => {
    repo.findById.mockResolvedValue({ ...requested, tool: "SCENE" });
    await run();
    expect(repo.markFailed).toHaveBeenCalledWith("e1", "In a scene is not available yet");
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
