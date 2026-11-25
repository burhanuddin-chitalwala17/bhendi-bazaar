/**
 * The text half of the adapter contract (ADR-0087): each provider's own reply — text with usage, a
 * refusal, an empty answer, a 5xx, an empty account — becomes the same classified outcome. `fetch` is
 * stubbed; nothing goes near a network. A new text adapter joins `CASES`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { GENERATION_FAILURE } from "@server/content/generation/generation.types";
import { textModelById } from "@server/content/generation/registry";
import type { Adapter } from "@server/content/generation/adapters/adapter";
import { gatewayAdapter } from "@server/content/generation/adapters/gateway";
import { geminiAdapter } from "@server/content/generation/adapters/gemini";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

interface Case {
  name: string;
  adapter: Adapter;
  model: string;
  env: Record<string, string>;
  success: () => Response;
  refused: () => Response;
  empty: () => Response;
  assertRequest: (url: string, init: RequestInit) => void;
}

const CASES: Case[] = [
  {
    name: "Gemini generateContent",
    adapter: geminiAdapter,
    model: "gemini/gemini-2.5-flash",
    env: { IMAGE_GEN_GEMINI_API_KEY: "gk" },
    success: () =>
      json({
        candidates: [{ finishReason: "STOP", content: { parts: [{ text: "A caption" }] } }],
        usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30 },
      }),
    refused: () => json({ promptFeedback: { blockReason: "SAFETY" } }),
    empty: () => json({ candidates: [{ finishReason: "STOP", content: { parts: [] } }] }),
    assertRequest: (url, init) => {
      expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
      expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("gk");
      const body = JSON.parse(String(init.body)) as { contents: Array<{ parts: Array<{ text: string }> }>; generationConfig: Record<string, unknown> };
      expect(body.contents[0]?.parts[0]?.text).toBe("facts");
      expect(body.generationConfig).toMatchObject({ maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } });
    },
  },
  {
    name: "gateway, hosted text model",
    adapter: gatewayAdapter,
    model: "cf/llama-3.3-70b",
    env: { IMAGE_GEN_CLOUDFLARE_ACCOUNT_ID: "acct", IMAGE_GEN_CLOUDFLARE_API_TOKEN: "tok" },
    success: () => json({ result: { response: "A caption", usage: { prompt_tokens: 120, completion_tokens: 30 } }, success: true }),
    refused: () => json({ success: false, errors: [{ message: "Blocked by content policy" }] }),
    empty: () => json({ result: { response: "" }, success: true }),
    assertRequest: (url, init) => {
      expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast");
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
      expect(JSON.parse(String(init.body))).toEqual({ messages: [{ role: "user", content: "facts" }], max_tokens: 800 });
    },
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.each(CASES)("$name", (c) => {
  const model = textModelById(c.model)!;
  const call = () => c.adapter.callText!(model, { prompt: "facts", maxOutputTokens: 800 });
  const reply = (response: () => Response) => {
    for (const [key, value] of Object.entries(c.env)) vi.stubEnv(key, value);
    const fetchMock = vi.fn(async () => response());
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("speaks the provider's shape and returns the text with its token counts", async () => {
    const fetchMock = reply(c.success);
    expect(await call()).toEqual({ text: "A caption", inputTokens: 120, outputTokens: 30 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    c.assertRequest(url, init);
  });

  it("classifies a refusal inside a 2xx as REFUSED", async () => {
    reply(c.refused);
    await expect(call()).rejects.toMatchObject({ kind: GENERATION_FAILURE.REFUSED });
  });

  it("classifies an empty answer as BAD_OUTPUT", async () => {
    reply(c.empty);
    await expect(call()).rejects.toMatchObject({ kind: GENERATION_FAILURE.BAD_OUTPUT });
  });

  it("classifies a 5xx as UNAVAILABLE and an empty account as NO_CREDIT", async () => {
    reply(() => json({}, 503));
    await expect(call()).rejects.toMatchObject({ kind: GENERATION_FAILURE.UNAVAILABLE });
    reply(() => json({ error: "insufficient balance" }, 402));
    await expect(call()).rejects.toMatchObject({ kind: GENERATION_FAILURE.NO_CREDIT });
  });

  it("is unavailable, without calling, when not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const key of Object.keys(c.env)) vi.stubEnv(key, "");
    expect(c.adapter.isConfigured()).toBe(false);
    await expect(call()).rejects.toMatchObject({ kind: GENERATION_FAILURE.UNAVAILABLE });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
