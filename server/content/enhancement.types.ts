import type {
  EnhancementState as PrismaEnhancementState,
  EnhancementTool as PrismaEnhancementTool,
} from "@prisma/client";

/**
 * The closed sets of image enhancement, declared once for the server, the schema and the sheet
 * (image-enhancement trd D1, D2). They mirror the Prisma enums and `satisfies` holds each mirror
 * complete, because this module is loaded in the browser and may not import the client as a value.
 */
export const ENHANCEMENT_TOOL = {
  CUTOUT: "CUTOUT",
  WHITE: "WHITE",
  STUDIO: "STUDIO",
  SCENE: "SCENE",
  LIGHT: "LIGHT",
  ENLARGE: "ENLARGE",
} as const satisfies Record<PrismaEnhancementTool, PrismaEnhancementTool>;
export type EnhancementTool = (typeof ENHANCEMENT_TOOL)[keyof typeof ENHANCEMENT_TOOL];

export const ENHANCEMENT_STATE = {
  REQUESTED: "REQUESTED",
  RUNNING: "RUNNING",
  PROPOSED: "PROPOSED",
  ACCEPTED: "ACCEPTED",
  DISCARDED: "DISCARDED",
  FAILED: "FAILED",
} as const satisfies Record<PrismaEnhancementState, PrismaEnhancementState>;
export type EnhancementState = (typeof ENHANCEMENT_STATE)[keyof typeof ENHANCEMENT_STATE];

/**
 * Which service performed a run (spec R8, trd D3), named for what it is to us rather than for the
 * company behind it (ADR-0037): `sharp` is our own CPU, `zone` the image host our pictures are
 * already served from, `model` a hosted vision model. Nothing outside `providers/` knows more.
 */
export const ENHANCEMENT_PROVIDER = { SHARP: "sharp", ZONE: "zone", MODEL: "model" } as const;
export type EnhancementProvider = (typeof ENHANCEMENT_PROVIDER)[keyof typeof ENHANCEMENT_PROVIDER];

/** The one row the platform's numbers live in, addressed by this id rather than by a search. */
export const ENHANCEMENT_SETTINGS_ID = "platform";

/**
 * The last of three layers, not a policy. An allowance is the org's own number if it has one,
 * else the platform's setting, else this — which exists only so a database nobody has configured
 * yet still answers (trd D5). The platform owner changes the first two without a deploy.
 */
export const FALLBACK_MONTHLY_ALLOWANCE = 300;
/** ₹500 a day across every org, as paise (Invariant 3), until the owner sets otherwise. */
export const FALLBACK_DAILY_CAP_PAISE = 50_000;

/** The three layers as one function, so the order is tested rather than retyped as `??` chains. */
export function resolveAllowance(orgOverride: number | null, platformDefault: number | null): number {
  return orgOverride ?? platformDefault ?? FALLBACK_MONTHLY_ALLOWANCE;
}

/** The daily cap has no per-org layer: one platform, one day, one number (trd D5). */
export function resolveDailyCap(platform: number | null): number {
  return platform ?? FALLBACK_DAILY_CAP_PAISE;
}

/**
 * The tools that have a pipeline. A tool not listed is refused as "not available yet" (trd D2): the
 * six are declared up front so the ledger and the sheet know the whole set, and each joins this
 * list in the PR that builds it.
 */
export const AVAILABLE_TOOLS = [
  ENHANCEMENT_TOOL.WHITE,
  ENHANCEMENT_TOOL.STUDIO,
  ENHANCEMENT_TOOL.SCENE,
  ENHANCEMENT_TOOL.CUTOUT,
  ENHANCEMENT_TOOL.LIGHT,
  ENHANCEMENT_TOOL.ENLARGE,
] as const;
export type AvailableTool = (typeof AVAILABLE_TOOLS)[number];

export function isAvailableTool(tool: EnhancementTool): tool is AvailableTool {
  return (AVAILABLE_TOOLS as readonly EnhancementTool[]).includes(tool);
}

/** ≈$0.002 an image at the hosted model's price (trd D3), rounded up to the whole paisa. */
export const MODEL_SEGMENT_PAISE = 18;

/** ≈$0.04 a painted scene at the hosted model's price (trd D3), rounded up to the whole paisa. */
export const SCENE_PAINT_PAISE = 350;

/**
 * What one run costs the platform, in paise, by the tool and the service that performed it
 * (spec R9, trd D6). Read at the moment the run is recorded, so changing which service performs a
 * tool changes what the ledger says and nothing else moves. Our own CPU is free, and so are the
 * image host's first 5,000 cut-outs a month; only the hosted model is billed.
 */
export const TOOL_COST_PAISE: Record<AvailableTool, Record<EnhancementProvider, number>> = {
  [ENHANCEMENT_TOOL.WHITE]: {
    [ENHANCEMENT_PROVIDER.SHARP]: 0,
    [ENHANCEMENT_PROVIDER.ZONE]: 0,
    [ENHANCEMENT_PROVIDER.MODEL]: MODEL_SEGMENT_PAISE,
  },
  [ENHANCEMENT_TOOL.STUDIO]: {
    [ENHANCEMENT_PROVIDER.SHARP]: 0,
    [ENHANCEMENT_PROVIDER.ZONE]: 0,
    [ENHANCEMENT_PROVIDER.MODEL]: MODEL_SEGMENT_PAISE,
  },
  [ENHANCEMENT_TOOL.CUTOUT]: {
    [ENHANCEMENT_PROVIDER.SHARP]: 0,
    [ENHANCEMENT_PROVIDER.ZONE]: 0,
    [ENHANCEMENT_PROVIDER.MODEL]: MODEL_SEGMENT_PAISE,
  },
  // Only the hosted model paints; the other two are priced at nothing because they cannot do it
  // at all, which `scenePainterFor` refuses before a run rather than charging zero for.
  [ENHANCEMENT_TOOL.SCENE]: {
    [ENHANCEMENT_PROVIDER.SHARP]: 0,
    [ENHANCEMENT_PROVIDER.ZONE]: 0,
    [ENHANCEMENT_PROVIDER.MODEL]: SCENE_PAINT_PAISE,
  },
  [ENHANCEMENT_TOOL.LIGHT]: {
    [ENHANCEMENT_PROVIDER.SHARP]: 0,
    [ENHANCEMENT_PROVIDER.ZONE]: 0,
    [ENHANCEMENT_PROVIDER.MODEL]: 0,
  },
  // A plain resize on our own CPU, never a service: an upscaler that reconstructs detail would
  // change the product's own pixels, which is refused on fidelity rather than on price (trd D2).
  [ENHANCEMENT_TOOL.ENLARGE]: {
    [ENHANCEMENT_PROVIDER.SHARP]: 0,
    [ENHANCEMENT_PROVIDER.ZONE]: 0,
    [ENHANCEMENT_PROVIDER.MODEL]: 0,
  },
};

/** One thing one service did in the course of a run: what was asked of it, and which one did it. */
export interface RunStep {
  tool: AvailableTool;
  provider: EnhancementProvider;
}

/**
 * What a run cost the platform: the sum of every service it actually used (spec R9, trd D6).
 *
 * Most tools are one step and one price. A scene is two — the cut-out and the paint, which may be
 * different services and are priced as what each of them did — so a single lookup would under-bill
 * it by whatever the cut-out cost. **The run's total is what the row records and what the daily
 * cap counts**; a second column for the breakdown would be a second thing to keep in step with
 * this one, and nothing reads it.
 */
export function runCostPaise(steps: readonly RunStep[]): number {
  return steps.reduce((total, step) => total + TOOL_COST_PAISE[step.tool][step.provider], 0);
}

/** One line per tool, as the sheet lists them (spec R1). */
export const TOOL_COPY: Record<EnhancementTool, { label: string; line: string }> = {
  [ENHANCEMENT_TOOL.CUTOUT]: { label: "Cut out", line: "The product alone, on nothing" },
  [ENHANCEMENT_TOOL.WHITE]: { label: "On plain white", line: "What Amazon and Flipkart ask for" },
  [ENHANCEMENT_TOOL.STUDIO]: { label: "Studio", line: "On a plain backdrop with a soft shadow" },
  [ENHANCEMENT_TOOL.SCENE]: { label: "In a scene", line: "Placed in a real-looking setting" },
  [ENHANCEMENT_TOOL.LIGHT]: { label: "Fix the light", line: "Brighter, sharper, nothing else changed" },
  [ENHANCEMENT_TOOL.ENLARGE]: { label: "Make it bigger", line: "Large enough for a marketplace to accept" },
};

/**
 * The states a run counts against the month in (trd D5): asked for, being made, awaiting a
 * decision, kept — **or discarded**. The work is what costs, not the keeping of it: by the time a
 * proposal is on the screen the service has been paid and the platform's day is that much shorter,
 * so handing the slot back for a "no" would let one shop spend the platform's money without
 * spending its own. The org member is told this before choosing a tool, never after (spec R3, R7).
 *
 * A failed run is the exception, and the only one: nothing was produced, so nothing is charged.
 * Its cost, where a service was reached before the failure, stays recorded against the platform's
 * day, because that money did leave.
 */
export const USAGE_STATES = [
  ENHANCEMENT_STATE.REQUESTED,
  ENHANCEMENT_STATE.RUNNING,
  ENHANCEMENT_STATE.PROPOSED,
  ENHANCEMENT_STATE.ACCEPTED,
  ENHANCEMENT_STATE.DISCARDED,
] as const;

export interface TimeWindow {
  start: Date;
  /** Exclusive. */
  end: Date;
}

/** The UTC calendar month `now` falls in — one clock for every org, whatever the browser's zone. */
export function monthWindow(now: Date): TimeWindow {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

/** The UTC day `now` falls in, for the platform-wide spend cap (trd D5). */
export function dayWindow(now: Date): TimeWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** Where a proposal waits (trd D1): a prefix no library lists, one object per run. */
export const PROPOSAL_PREFIX = "proposals/";

/** The two formats a proposal is ever written in, and the extension each key carries. */
export const PROPOSAL_MIME = { WEBP: "image/webp", PNG: "image/png" } as const;
export type ProposalMimeType = (typeof PROPOSAL_MIME)[keyof typeof PROPOSAL_MIME];
export const PROPOSAL_EXTENSION: Record<ProposalMimeType, string> = {
  [PROPOSAL_MIME.WEBP]: "webp",
  [PROPOSAL_MIME.PNG]: "png",
};

/**
 * What each tool writes. A cut-out is the one result whose transparency *is* the product, so it is
 * PNG and is never flattened into WebP; everything else is WebP at the stored quality (ADR-0026).
 * Keyed by every tool rather than the available ones, so a decided row can still be read back.
 */
export const TOOL_MIME_TYPE: Record<EnhancementTool, ProposalMimeType> = {
  [ENHANCEMENT_TOOL.CUTOUT]: PROPOSAL_MIME.PNG,
  [ENHANCEMENT_TOOL.WHITE]: PROPOSAL_MIME.WEBP,
  [ENHANCEMENT_TOOL.STUDIO]: PROPOSAL_MIME.WEBP,
  [ENHANCEMENT_TOOL.SCENE]: PROPOSAL_MIME.WEBP,
  [ENHANCEMENT_TOOL.LIGHT]: PROPOSAL_MIME.WEBP,
  [ENHANCEMENT_TOOL.ENLARGE]: PROPOSAL_MIME.WEBP,
};

/** One run, one key, fixed by the tool — which is what lets a resumed run write the same object. */
export function proposalKeyFor(enhancementId: string, tool: EnhancementTool): string {
  return `${PROPOSAL_PREFIX}${enhancementId}.${PROPOSAL_EXTENSION[TOOL_MIME_TYPE[tool]]}`;
}

/** How a result names its making: `MediaAsset.transform` on the DERIVED image (trd, data model). */
export type EnhancementTransform = {
  tool: EnhancementTool;
  preset: string | null;
  provider: string;
  enhancementId: string;
};

/** What a sheet or a slot asks for (spec R2, R5). The photo is named by id or by the URL its row carries. */
export interface RequestEnhancementInput {
  tool: EnhancementTool;
  preset?: string | null;
  sourceAssetId?: string | null;
  sourceRef?: string | null;
  slot?: string | null;
  /** The slot's role as the editor resolved it; `label` is refused (spec R5, trd D8). */
  slotRole?: string | null;
}

/** The ledger row as the repository selects it, with the refs of the two assets it points at. */
export interface EnhancementRow {
  id: string;
  orgId: string;
  requesterId: string | null;
  sourceAssetId: string;
  tool: EnhancementTool;
  preset: string | null;
  provider: string;
  state: EnhancementState;
  slot: string | null;
  proposalKey: string | null;
  resultAssetId: string | null;
  costPaise: number;
  error: string | null;
  createdAt: Date;
  proposedAt: Date | null;
  decidedAt: Date | null;
  sourceAsset: { ref: string };
  resultAsset: { ref: string } | null;
}

/**
 * A run as the org portal sees it (trd, API). `proposalUrl` is set only while there is something to
 * compare — a decided or failed run has no proposal — and `resultRef` is the accepted image's URL,
 * what the gallery row takes over. Cost is integer paise; timestamps cross as ISO strings.
 */
export interface EnhancementDto {
  id: string;
  tool: EnhancementTool;
  preset: string | null;
  state: EnhancementState;
  sourceAssetId: string;
  sourceRef: string;
  proposalUrl: string | null;
  resultAssetId: string | null;
  resultRef: string | null;
  error: string | null;
  costPaise: number;
  createdAt: string;
  proposedAt: string | null;
  decidedAt: string | null;
}

/** The org's standing this month (spec R7, A5): what it used, what it may, and whether it is paused. */
export interface EnhancementUsage {
  used: number;
  /** Resolved, never a stored copy: the org's override where it has one, else the platform's. */
  allowance: number;
  paused: boolean;
  pauseReason: string | null;
}

/** The platform's two numbers as the admin page reads them (spec R7). Money is paise (Invariant 3). */
export interface EnhancementSettingsDto {
  defaultMonthlyAllowance: number;
  dailyCapPaise: number;
  /** False while these are the fallbacks above — nobody has saved a setting yet. */
  configured: boolean;
}

/** One org's deviation from the platform's numbers, resolved for display beside it. */
export interface OrgEnhancementPolicyView {
  /** What the org may do this month, after the three layers. */
  monthlyAllowance: number;
  /** What its own row says, or null where it defers to the platform. */
  monthlyAllowanceOverride: number | null;
  paused: boolean;
  pauseReason: string | null;
}

/** What the platform owner sets for one org: an allowance of its own, a pause, or neither. */
export interface SetOrgEnhancementPolicyInput {
  monthlyAllowance: number | null;
  paused: boolean;
  pauseReason: string | null;
}

/** One org's month, as the platform owner's table lists it (spec R7): use, spend and standing. */
export interface OrgEnhancementUsage extends OrgEnhancementPolicyView {
  orgId: string;
  name: string;
  code: string;
  used: number;
  /** What this org's runs cost the platform this month, in paise — a discarded run still cost. */
  spentPaise: number;
}

export function toEnhancementDto(row: EnhancementRow, publicUrl: (key: string) => string): EnhancementDto {
  return {
    id: row.id,
    tool: row.tool,
    preset: row.preset,
    state: row.state,
    sourceAssetId: row.sourceAssetId,
    sourceRef: row.sourceAsset.ref,
    proposalUrl: row.state === ENHANCEMENT_STATE.PROPOSED && row.proposalKey ? publicUrl(row.proposalKey) : null,
    resultAssetId: row.resultAssetId,
    resultRef: row.resultAsset?.ref ?? null,
    error: row.error,
    costPaise: row.costPaise,
    createdAt: row.createdAt.toISOString(),
    proposedAt: row.proposedAt ? row.proposedAt.toISOString() : null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  };
}
