/**
 * The declared sets and pure helpers of image enhancement (image-enhancement trd D1, D2, D5): the
 * browser-safe mirrors match the Prisma enums, the usage window is the UTC month and the cap's the
 * UTC day, only a tool with a pipeline is available and every available tool is priced in whole
 * paise, the DTO shows a proposal only while there is one, and the request schema names the photo
 * exactly one way.
 */
import { describe, expect, it } from "vitest";
import { EnhancementState as PrismaEnhancementState, EnhancementTool as PrismaEnhancementTool } from "@prisma/client";
import {
  AVAILABLE_TOOLS,
  ENHANCEMENT_PROVIDER,
  ENHANCEMENT_SETTINGS_ID,
  ENHANCEMENT_STATE,
  ENHANCEMENT_TOOL,
  FALLBACK_DAILY_CAP_PAISE,
  FALLBACK_MONTHLY_ALLOWANCE,
  MODEL_SEGMENT_PAISE,
  TOOL_COPY,
  TOOL_COST_PAISE,
  TOOL_MIME_TYPE,
  USAGE_STATES,
  dayWindow,
  isAvailableTool,
  monthWindow,
  proposalKeyFor,
  resolveAllowance,
  resolveDailyCap,
  toEnhancementDto,
  type EnhancementRow,
} from "@server/content/enhancement.types";
import {
  enhancementSettingsSchema,
  orgEnhancementPolicySchema,
  requestEnhancementSchema,
} from "@/lib/validation/schemas/enhancement.schema";

const row = (over: Partial<EnhancementRow> = {}): EnhancementRow => ({
  id: "e1",
  orgId: "org-1",
  requesterId: "u1",
  sourceAssetId: "a1",
  tool: ENHANCEMENT_TOOL.LIGHT,
  preset: null,
  provider: "sharp",
  state: ENHANCEMENT_STATE.REQUESTED,
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
  ...over,
});

describe("the closed sets mirror the schema", () => {
  it("names every tool and every state the database knows, and nothing else", () => {
    expect(Object.keys(ENHANCEMENT_TOOL).sort()).toEqual(Object.keys(PrismaEnhancementTool).sort());
    expect(Object.keys(ENHANCEMENT_STATE).sort()).toEqual(Object.keys(PrismaEnhancementState).sort());
  });

  it("offers only a tool with a pipeline, and prices every one it offers in whole paise", () => {
    expect([...AVAILABLE_TOOLS].sort()).toEqual(
      [
        ENHANCEMENT_TOOL.CUTOUT,
        ENHANCEMENT_TOOL.ENLARGE,
        ENHANCEMENT_TOOL.LIGHT,
        ENHANCEMENT_TOOL.STUDIO,
        ENHANCEMENT_TOOL.WHITE,
      ].sort(),
    );
    for (const tool of AVAILABLE_TOOLS) expect(isAvailableTool(tool)).toBe(true);
    expect(isAvailableTool(ENHANCEMENT_TOOL.SCENE)).toBe(false);
    expect(Object.keys(TOOL_COST_PAISE).sort()).toEqual([...AVAILABLE_TOOLS].sort());
    for (const byProvider of Object.values(TOOL_COST_PAISE)) {
      expect(Object.keys(byProvider).sort()).toEqual(Object.values(ENHANCEMENT_PROVIDER).sort());
      for (const cost of Object.values(byProvider)) {
        expect(Number.isInteger(cost)).toBe(true);
        expect(cost).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("prices a run by the tool and the service that performed it, not by the tool alone", () => {
    // Our own CPU and the image host's free tier are both nothing; only the hosted model is billed,
    // which is the whole reason the table has two keys rather than one (trd D6).
    for (const tool of AVAILABLE_TOOLS) {
      expect(TOOL_COST_PAISE[tool][ENHANCEMENT_PROVIDER.SHARP]).toBe(0);
      expect(TOOL_COST_PAISE[tool][ENHANCEMENT_PROVIDER.ZONE]).toBe(0);
    }
    expect(TOOL_COST_PAISE[ENHANCEMENT_TOOL.CUTOUT][ENHANCEMENT_PROVIDER.MODEL]).toBe(MODEL_SEGMENT_PAISE);
    expect(TOOL_COST_PAISE[ENHANCEMENT_TOOL.WHITE][ENHANCEMENT_PROVIDER.MODEL]).toBe(MODEL_SEGMENT_PAISE);
    expect(TOOL_COST_PAISE[ENHANCEMENT_TOOL.STUDIO][ENHANCEMENT_PROVIDER.MODEL]).toBe(MODEL_SEGMENT_PAISE);
    // `light` never asks a service for anything, so no service can make it cost. Nor does
    // `enlarge`: a plain resize runs on our own CPU, and an upscaler that would cost something
    // is refused because it redraws the product, not because of the bill (trd D2).
    expect(TOOL_COST_PAISE[ENHANCEMENT_TOOL.LIGHT][ENHANCEMENT_PROVIDER.MODEL]).toBe(0);
    expect(TOOL_COST_PAISE[ENHANCEMENT_TOOL.ENLARGE][ENHANCEMENT_PROVIDER.MODEL]).toBe(0);
    expect(MODEL_SEGMENT_PAISE).toBe(18);
  });

  it("names a service for what it is to us, never for the company behind it", () => {
    expect(Object.values(ENHANCEMENT_PROVIDER).sort()).toEqual(["model", "sharp", "zone"]);
  });

  it("has a line for all six tools, so the sheet can list any that becomes available", () => {
    expect(Object.keys(TOOL_COPY).sort()).toEqual(Object.keys(ENHANCEMENT_TOOL).sort());
  });

  it("says what each tool writes, with the cut-out the one that keeps its transparency", () => {
    expect(Object.keys(TOOL_MIME_TYPE).sort()).toEqual(Object.keys(ENHANCEMENT_TOOL).sort());
    expect(TOOL_MIME_TYPE[ENHANCEMENT_TOOL.CUTOUT]).toBe("image/png");
    for (const tool of [
      ENHANCEMENT_TOOL.WHITE,
      ENHANCEMENT_TOOL.STUDIO,
      ENHANCEMENT_TOOL.LIGHT,
      ENHANCEMENT_TOOL.ENLARGE,
    ]) {
      expect(TOOL_MIME_TYPE[tool]).toBe("image/webp");
    }
  });

  it("keeps the em dash out of what the sheet shows, and every line short enough for a phone", () => {
    for (const { label, line } of Object.values(TOOL_COPY)) {
      expect(`${label} ${line}`).not.toMatch(/[\u2014\u2013]/);
      expect(line.length, `"${line}" is long for 360px`).toBeLessThanOrEqual(48);
    }
  });

  it("declares the fallbacks once: 300 a month, ₹500 a day as paise", () => {
    expect(FALLBACK_MONTHLY_ALLOWANCE).toBe(300);
    expect(FALLBACK_DAILY_CAP_PAISE).toBe(500 * 100);
    expect(Number.isInteger(FALLBACK_DAILY_CAP_PAISE)).toBe(true);
  });

  it("addresses the settings row by a constant, so a second row cannot be written by accident", () => {
    expect(ENHANCEMENT_SETTINGS_ID).toBe("platform");
  });
});

describe("an allowance resolves through three layers", () => {
  it("prefers the org's own number", () => {
    expect(resolveAllowance(50, 400)).toBe(50);
    expect(resolveAllowance(50, null)).toBe(50);
  });

  it("falls to the platform's setting where the org defers", () => {
    expect(resolveAllowance(null, 400)).toBe(400);
  });

  it("falls to the constant only where nobody has configured anything", () => {
    expect(resolveAllowance(null, null)).toBe(FALLBACK_MONTHLY_ALLOWANCE);
  });

  it("treats zero as a number somebody meant, not as absence", () => {
    // `||` here would read a deliberate zero as "unset" and hand back 300 — the whole reason
    // this is one tested function rather than a `??` chain retyped at each call site.
    expect(resolveAllowance(0, 400)).toBe(0);
    expect(resolveAllowance(null, 0)).toBe(0);
  });

  it("has no per-org layer for the daily cap: one platform, one day, one number", () => {
    expect(resolveDailyCap(20_000)).toBe(20_000);
    expect(resolveDailyCap(null)).toBe(FALLBACK_DAILY_CAP_PAISE);
    expect(resolveDailyCap(0)).toBe(0);
  });
});

describe("the usage window", () => {
  it("counts a run from the moment it is asked for, and a discard does not give the slot back", () => {
    // The old rule handed a slot back on "no". By then the service had been paid and the
    // platform's day was that much shorter, so a shop could spend the platform's money
    // without spending its own.
    expect([...USAGE_STATES]).toEqual([
      ENHANCEMENT_STATE.REQUESTED,
      ENHANCEMENT_STATE.RUNNING,
      ENHANCEMENT_STATE.PROPOSED,
      ENHANCEMENT_STATE.ACCEPTED,
      ENHANCEMENT_STATE.DISCARDED,
    ]);
  });

  it("is the UTC calendar month, whatever zone the browser was in", () => {
    // 27 Sept 23:30 IST is 27 Sept 18:00 UTC: still September.
    expect(monthWindow(new Date("2026-09-27T23:30:00+05:30"))).toEqual({
      start: new Date("2026-09-01T00:00:00Z"),
      end: new Date("2026-10-01T00:00:00Z"),
    });
    // 1 Oct 02:00 IST is 30 Sept 20:30 UTC: September in UTC, not October.
    expect(monthWindow(new Date("2026-10-01T02:00:00+05:30")).start).toEqual(new Date("2026-09-01T00:00:00Z"));
    // December rolls into the next year.
    expect(monthWindow(new Date("2026-12-15T00:00:00Z")).end).toEqual(new Date("2027-01-01T00:00:00Z"));
  });

  it("the spend cap's day is the UTC day", () => {
    expect(dayWindow(new Date("2026-09-27T18:00:00Z"))).toEqual({
      start: new Date("2026-09-27T00:00:00Z"),
      end: new Date("2026-09-28T00:00:00Z"),
    });
  });
});

describe("the proposal's place and the DTO", () => {
  it("keys a proposal under its own prefix by run id, in the format its tool writes", () => {
    expect(proposalKeyFor("e1", ENHANCEMENT_TOOL.LIGHT)).toBe("proposals/e1.webp");
    // A cut-out is PNG: flattening it into WebP would throw away the transparency that is the result.
    expect(proposalKeyFor("e1", ENHANCEMENT_TOOL.CUTOUT)).toBe("proposals/e1.png");
  });

  it("shows the proposal only while there is one to compare, and the result only once kept", () => {
    const publicUrl = (key: string) => `https://img.test/${key}`;
    const proposed = toEnhancementDto(
      row({ state: ENHANCEMENT_STATE.PROPOSED, proposalKey: "proposals/e1.webp", proposedAt: new Date("2026-09-27T10:00:05Z") }),
      publicUrl,
    );
    expect(proposed).toMatchObject({
      id: "e1",
      tool: "LIGHT",
      state: "PROPOSED",
      sourceRef: "https://img.test/products/o/a.webp",
      proposalUrl: "https://img.test/proposals/e1.webp",
      resultRef: null,
      costPaise: 0,
      createdAt: "2026-09-27T10:00:00.000Z",
      proposedAt: "2026-09-27T10:00:05.000Z",
      decidedAt: null,
    });

    const accepted = toEnhancementDto(
      row({
        state: ENHANCEMENT_STATE.ACCEPTED,
        proposalKey: "proposals/e1.webp",
        resultAssetId: "d1",
        resultAsset: { ref: "https://img.test/products/o/a-light-e1.webp" },
        decidedAt: new Date("2026-09-27T10:01:00Z"),
      }),
      publicUrl,
    );
    expect(accepted.proposalUrl).toBeNull();
    expect(accepted.resultRef).toBe("https://img.test/products/o/a-light-e1.webp");
    expect(accepted.decidedAt).toBe("2026-09-27T10:01:00.000Z");

    // A row never carries a URL of its own: the DTO derives both from the assets it points at.
    expect(Object.keys(proposed)).not.toContain("proposalKey");
  });
});

describe("the request schema", () => {
  const valid = { tool: "LIGHT", sourceRef: "https://img.test/products/o/a.webp", slot: "front", slotRole: "product" };

  it("accepts a photo named by URL, or by asset id", () => {
    expect(requestEnhancementSchema.parse(valid)).toEqual(valid);
    expect(requestEnhancementSchema.parse({ tool: "LIGHT", sourceAssetId: "a1" })).toEqual({ tool: "LIGHT", sourceAssetId: "a1" });
  });

  it("refuses a photo named both ways, or neither", () => {
    expect(requestEnhancementSchema.safeParse({ ...valid, sourceAssetId: "a1" }).success).toBe(false);
    expect(requestEnhancementSchema.safeParse({ tool: "LIGHT" }).success).toBe(false);
  });

  it("refuses a tool, a role or a URL it does not know", () => {
    expect(requestEnhancementSchema.safeParse({ ...valid, tool: "sparkle" }).success).toBe(false);
    expect(requestEnhancementSchema.safeParse({ ...valid, slotRole: "hero" }).success).toBe(false);
    expect(requestEnhancementSchema.safeParse({ ...valid, sourceRef: "products/o/a.webp" }).success).toBe(false);
  });
});

describe("requestEnhancementSchema", () => {
  const photo = { tool: ENHANCEMENT_TOOL.LIGHT, sourceRef: "https://img.test/a.webp" };

  it("takes an extra photo, which says it has no slot rather than staying silent", () => {
    const parsed = requestEnhancementSchema.parse({ ...photo, slot: null, slotRole: null });
    expect(parsed).toMatchObject({ tool: ENHANCEMENT_TOOL.LIGHT, sourceRef: "https://img.test/a.webp" });
    expect(parsed.slot).toBeUndefined();
    expect(parsed.slotRole).toBeUndefined();
  });

  it("takes a photo in a slot, and the role travels with it so the label can be refused", () => {
    const parsed = requestEnhancementSchema.parse({ ...photo, slot: "front", slotRole: "product" });
    expect(parsed).toMatchObject({ slot: "front", slotRole: "product" });
  });

  it("names the photo one way or the other, never both and never neither", () => {
    expect(requestEnhancementSchema.safeParse({ tool: ENHANCEMENT_TOOL.LIGHT }).success).toBe(false);
    expect(
      requestEnhancementSchema.safeParse({ ...photo, sourceAssetId: "a1" }).success,
      "both an id and a URL is ambiguous, not generous",
    ).toBe(false);
    expect(requestEnhancementSchema.safeParse({ tool: ENHANCEMENT_TOOL.LIGHT, sourceAssetId: "a1" }).success).toBe(true);
  });

  it("refuses a tool that is not one of the six", () => {
    expect(requestEnhancementSchema.safeParse({ ...photo, tool: "POLISH" }).success).toBe(false);
  });
});

describe("the two schemas the platform owner's forms send", () => {
  const settings = { defaultMonthlyAllowance: 300, dailyCapPaise: 50_000 };

  it("takes two positive whole numbers, and the cap in paise rather than rupees", () => {
    expect(enhancementSettingsSchema.parse(settings)).toEqual(settings);
    // ₹500 is 50,000 paise (Invariant 3). A form sending 500 would be a cap of ₹5 — a valid
    // payload with the wrong meaning, which is why the field is named for its unit.
    expect(enhancementSettingsSchema.parse({ ...settings, dailyCapPaise: 500 }).dailyCapPaise).toBe(500);
  });

  it("refuses zero, a negative, a fraction and a missing number", () => {
    for (const bad of [0, -1, 12.5]) {
      expect(enhancementSettingsSchema.safeParse({ ...settings, defaultMonthlyAllowance: bad }).success).toBe(false);
      expect(enhancementSettingsSchema.safeParse({ ...settings, dailyCapPaise: bad }).success).toBe(false);
    }
    expect(enhancementSettingsSchema.safeParse({ defaultMonthlyAllowance: 300 }).success).toBe(false);
  });

  it("takes an org override, a pause and a reason — and a null override, which is how a row is dropped", () => {
    expect(orgEnhancementPolicySchema.parse({ monthlyAllowance: 20, paused: true, pauseReason: "Unpaid invoice" })).toEqual({
      monthlyAllowance: 20,
      paused: true,
      pauseReason: "Unpaid invoice",
    });
    expect(orgEnhancementPolicySchema.parse({ monthlyAllowance: null, paused: false, pauseReason: null })).toEqual({
      monthlyAllowance: null,
      paused: false,
      pauseReason: null,
    });
  });

  it("refuses an override that is not a positive whole number, and a pause that is not stated", () => {
    expect(orgEnhancementPolicySchema.safeParse({ monthlyAllowance: 0, paused: false, pauseReason: null }).success).toBe(false);
    expect(orgEnhancementPolicySchema.safeParse({ monthlyAllowance: 1.5, paused: false, pauseReason: null }).success).toBe(false);
    expect(orgEnhancementPolicySchema.safeParse({ monthlyAllowance: null, pauseReason: null }).success).toBe(false);
    expect(orgEnhancementPolicySchema.safeParse({ monthlyAllowance: null, paused: false, pauseReason: "" }).success).toBe(false);
  });
});

describe("naming the photo from either surface", () => {
  it("a gallery row names it by the URL it carries; the library by the asset itself", () => {
    const gallery = requestEnhancementSchema.parse({
      tool: ENHANCEMENT_TOOL.WHITE,
      sourceRef: "https://img.test/a.webp",
      slot: "front",
      slotRole: "product",
    });
    expect(gallery).toMatchObject({ sourceRef: "https://img.test/a.webp", slot: "front" });
    expect(gallery.sourceAssetId).toBeUndefined();

    const library = requestEnhancementSchema.parse({
      tool: ENHANCEMENT_TOOL.WHITE,
      sourceAssetId: "a1",
      slot: null,
      slotRole: null,
    });
    expect(library).toMatchObject({ sourceAssetId: "a1" });
    expect(library.sourceRef).toBeUndefined();
    expect(library.slot).toBeUndefined();
  });
});

describe("what a month's use counts", () => {
  it("counts a discarded run: the work is what costs, not the keeping of it", () => {
    expect(USAGE_STATES).toContain(ENHANCEMENT_STATE.DISCARDED);
    expect(USAGE_STATES).toContain(ENHANCEMENT_STATE.PROPOSED);
    expect(USAGE_STATES).toContain(ENHANCEMENT_STATE.ACCEPTED);
  });

  it("does not count a failed run, the one case where nothing was produced", () => {
    expect(USAGE_STATES).not.toContain(ENHANCEMENT_STATE.FAILED);
  });

  it("counts every state but that one, so a slot cannot be handed back by waiting", () => {
    const uncounted = Object.values(ENHANCEMENT_STATE).filter(
      (state) => !(USAGE_STATES as readonly string[]).includes(state),
    );
    expect(uncounted).toEqual([ENHANCEMENT_STATE.FAILED]);
  });
});
