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
  DEFAULT_MONTHLY_ALLOWANCE,
  ENHANCEMENT_DAILY_CAP_PAISE,
  ENHANCEMENT_STATE,
  ENHANCEMENT_TOOL,
  TOOL_COPY,
  TOOL_COST_PAISE,
  TOOL_PROVIDER,
  USAGE_STATES,
  dayWindow,
  isAvailableTool,
  monthWindow,
  proposalKeyFor,
  toEnhancementDto,
  type EnhancementRow,
} from "@server/content/enhancement.types";
import { requestEnhancementSchema } from "@/lib/validation/schemas/enhancement.schema";

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
    expect([...AVAILABLE_TOOLS]).toEqual([ENHANCEMENT_TOOL.LIGHT]);
    expect(isAvailableTool(ENHANCEMENT_TOOL.LIGHT)).toBe(true);
    for (const tool of [ENHANCEMENT_TOOL.CUTOUT, ENHANCEMENT_TOOL.WHITE, ENHANCEMENT_TOOL.STUDIO, ENHANCEMENT_TOOL.SCENE, ENHANCEMENT_TOOL.ENLARGE]) {
      expect(isAvailableTool(tool)).toBe(false);
    }
    expect(Object.keys(TOOL_COST_PAISE).sort()).toEqual([...AVAILABLE_TOOLS].sort());
    expect(Object.keys(TOOL_PROVIDER).sort()).toEqual([...AVAILABLE_TOOLS].sort());
    for (const cost of Object.values(TOOL_COST_PAISE)) {
      expect(Number.isInteger(cost)).toBe(true);
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });

  it("has a line for all six tools, so the sheet can list any that becomes available", () => {
    expect(Object.keys(TOOL_COPY).sort()).toEqual(Object.keys(ENHANCEMENT_TOOL).sort());
  });

  it("declares the TRD's numbers once: 200 a month, ₹500 a day as paise", () => {
    expect(DEFAULT_MONTHLY_ALLOWANCE).toBe(200);
    expect(ENHANCEMENT_DAILY_CAP_PAISE).toBe(500 * 100);
  });
});

describe("the usage window", () => {
  it("counts a run while it is asked for, running, proposed or kept — a discard or a failure gives the slot back", () => {
    expect([...USAGE_STATES]).toEqual([
      ENHANCEMENT_STATE.REQUESTED,
      ENHANCEMENT_STATE.RUNNING,
      ENHANCEMENT_STATE.PROPOSED,
      ENHANCEMENT_STATE.ACCEPTED,
    ]);
    expect(USAGE_STATES).not.toContain(ENHANCEMENT_STATE.DISCARDED);
    expect(USAGE_STATES).not.toContain(ENHANCEMENT_STATE.FAILED);
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
  it("keys a proposal under its own prefix by run id", () => {
    expect(proposalKeyFor("e1")).toBe("proposals/e1.webp");
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
