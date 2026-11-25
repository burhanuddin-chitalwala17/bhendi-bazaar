/**
 * Text joins the generation port (ADR-0087; ai-images/social-posts D3, D5): priced per token in
 * integer micro-dollars, a ledger row per call, a replay never pays twice, fallback only on
 * availability. The repository, router and rate are fakes; the text generator's decisions are under test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GENERATION_FAILURE, GenerationFailure, TEXT_PURPOSE, type TextGenerationRequest } from "@server/content/generation/generation.types";

const repo = { open: vi.fn(), recordPaid: vi.fn(), succeedText: vi.fn(), fail: vi.fn(), markRetriedAfterUnknown: vi.fn() };
const routeTextCall = vi.fn();
const eligibleTextModels = vi.fn();
const rateFor = vi.fn();

vi.mock("@server/content/generation.repository", () => ({ generationRepository: repo }));
vi.mock("@server/content/generation/exchange-rate", () => ({ rateFor: () => rateFor(), storedRateOrFetch: () => rateFor() }));
vi.mock("@server/content/generation/router", () => ({
  eligibleTextModels: (...a: unknown[]) => eligibleTextModels(...a),
  routeTextCall: (...a: unknown[]) => routeTextCall(...a),
}));

const { generateText, quoteText, worstInputTokens } = await import("@server/content/generation/text-generator");
const { textModelById, TEXT_MODELS, DEFAULT_TEXT_MODELS } = await import("@server/content/generation/registry");
const { priceTextMicroUsd } = await import("@server/content/generation/pricing");

const model = TEXT_MODELS[0]!;
const request: TextGenerationRequest = {
  purpose: TEXT_PURPOSE.CAPTION,
  prompt: "Write a caption",
  promptVersion: "caption.v1",
  maxOutputTokens: 1_000,
  idempotencyKey: "caption-r1:1",
};
const row = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  idempotencyKey: request.idempotencyKey,
  modelId: null,
  state: "SUBMITTED",
  outputKeys: [],
  outputText: null,
  costMicroUsd: 0,
  costPaise: 0,
  error: null,
  createdAt: new Date("2026-11-21T09:00:00Z"),
  ...over,
});
const now = new Date("2026-11-21T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  rateFor.mockResolvedValue({ day: new Date("2026-11-21"), paisePerUsd: 8_500 });
  eligibleTextModels.mockResolvedValue([model]);
});

describe("token pricing", () => {
  it("prices tokens per million in integer micro-dollars, rounded up", () => {
    expect(priceTextMicroUsd({ inputPerMillion: 300_000, outputPerMillion: 2_500_000 }, 1_000, 500)).toBe(300 + 1_250);
    expect(priceTextMicroUsd({ inputPerMillion: 300_000, outputPerMillion: 0 }, 1, 0)).toBe(1);
  });

  it("bounds the input by the prompt's bytes, so a Hindi prompt is never under-quoted", () => {
    expect(worstInputTokens("अब")).toBeGreaterThanOrEqual(Buffer.byteLength("अब", "utf8"));
  });

  it("knows a caption model order, every id in the registry, each with its source", () => {
    for (const id of DEFAULT_TEXT_MODELS[TEXT_PURPOSE.CAPTION]) expect(textModelById(id)?.checked).toBeTruthy();
  });

  it("quotes the worst case of every eligible model (D5)", async () => {
    const quoted = await quoteText(TEXT_PURPOSE.CAPTION, request.prompt, request.maxOutputTokens);
    expect(quoted?.worstCostPaise).toBeGreaterThan(0);
    expect(Number.isInteger(quoted?.worstCostPaise)).toBe(true);
  });
});

describe("generateText", () => {
  it("records what the reported tokens cost and keeps the text on the row", async () => {
    repo.open.mockResolvedValue({ row: row(), created: true });
    routeTextCall.mockResolvedValue({ model, text: "  A caption  ", inputTokens: 100, outputTokens: 50 });
    const result = await generateText(request, now);
    const micro = priceTextMicroUsd(model.price, 100, 50);
    expect(result).toMatchObject({ text: "A caption", modelId: model.id, costMicroUsd: micro });
    expect(repo.recordPaid).toHaveBeenCalledWith("g1", expect.objectContaining({ costMicroUsd: micro }));
    expect(repo.succeedText).toHaveBeenCalledWith("g1", "A caption");
  });

  it("charges the worst case when the provider reports no usage", async () => {
    repo.open.mockResolvedValue({ row: row(), created: true });
    routeTextCall.mockResolvedValue({ model, text: "A caption", inputTokens: null, outputTokens: null });
    const result = await generateText(request, now);
    expect(result.costMicroUsd).toBe(priceTextMicroUsd(model.price, worstInputTokens(request.prompt), request.maxOutputTokens));
  });

  it("replays a finished call without calling or paying again", async () => {
    repo.open.mockResolvedValue({ row: row({ state: "SUCCEEDED", modelId: model.id, outputText: "Kept", costPaise: 3 }), created: false });
    const result = await generateText(request, now);
    expect(result.text).toBe("Kept");
    expect(routeTextCall).not.toHaveBeenCalled();
    expect(repo.recordPaid).not.toHaveBeenCalled();
  });

  it("ends a refused call on the ledger and does not succeed it", async () => {
    repo.open.mockResolvedValue({ row: row(), created: true });
    routeTextCall.mockRejectedValue(new GenerationFailure(GENERATION_FAILURE.REFUSED, "safety", model.id));
    await expect(generateText(request, now)).rejects.toMatchObject({ kind: GENERATION_FAILURE.REFUSED });
    expect(repo.fail).toHaveBeenCalledWith("g1", true, expect.any(String), model.id);
    expect(repo.succeedText).not.toHaveBeenCalled();
  });

  it("records the worst case as spent when the answer may have been billed (UNCERTAIN)", async () => {
    repo.open.mockResolvedValue({ row: row(), created: true });
    routeTextCall.mockRejectedValue(new GenerationFailure(GENERATION_FAILURE.UNCERTAIN, "timeout", model.id));
    await expect(generateText(request, now)).rejects.toBeInstanceOf(GenerationFailure);
    expect(repo.recordPaid).toHaveBeenCalledOnce();
  });

  it("fails an empty answer as BAD_OUTPUT after recording what it cost", async () => {
    repo.open.mockResolvedValue({ row: row(), created: true });
    routeTextCall.mockResolvedValue({ model, text: "   ", inputTokens: 10, outputTokens: 1 });
    await expect(generateText(request, now)).rejects.toMatchObject({ kind: GENERATION_FAILURE.BAD_OUTPUT });
    expect(repo.recordPaid).toHaveBeenCalledOnce();
    expect(repo.succeedText).not.toHaveBeenCalled();
  });

  it("refuses before calling when nothing can take the request", async () => {
    repo.open.mockResolvedValue({ row: row(), created: true });
    eligibleTextModels.mockResolvedValue([]);
    await expect(generateText(request, now)).rejects.toMatchObject({ kind: GENERATION_FAILURE.UNAVAILABLE });
    expect(routeTextCall).not.toHaveBeenCalled();
  });
});
