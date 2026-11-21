import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { adminOrgService } from "@server/catalog/org.service";
import { SHOT_ROLE } from "@server/catalog/shot-list";
import { featureAccessService } from "@server/subscriptions/feature-access.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";
import { enhancementRepository } from "@server/content/enhancement.repository";
import { enhancementPolicyRepository } from "@server/content/enhancement-policy.repository";
import {
  enhancementSettingsRepository,
  type SaveEnhancementSettingsInput,
} from "@server/content/enhancement-settings.repository";
import { enhancementSpec } from "@server/content/enhancement.job";
import { ENLARGE_TARGET_LONG_EDGE } from "@server/content/channel-rules";
import { scenePainterFor, segmenterFor } from "@server/content/providers";
import { generationRepository } from "@server/content/generation.repository";
import { exchangeRateRepository } from "@server/content/exchange-rate.repository";
import { microUsdToPaise } from "@server/content/generation/pricing";
import type { Segmenter } from "@server/content/providers/segment";
import type { ScenePainter } from "@server/content/providers/scene";
import { scenePresetFor, type ScenePreset } from "@server/content/scene-presets";
import { lightFix } from "@server/content/tools/light";
import { cutOut } from "@server/content/tools/cutout";
import { onWhite } from "@server/content/tools/white";
import { inStudio } from "@server/content/tools/studio";
import { inScene } from "@server/content/tools/scene";
import { enlarge } from "@server/content/tools/enlarge";
import type { ToolInput, ToolResult } from "@server/content/tools/tool";
import {
  CUTOUT_OVERAGE_MICRO_USD,
  ENHANCEMENT_PROVIDER,
  ENHANCEMENT_STATE,
  FREE_CUTOUTS_PER_MONTH,
  SEGMENTING_TOOLS,
  ENHANCEMENT_TOOL,
  PROPOSAL_EXTENSION,
  TOOL_MIME_TYPE,
  dayWindow,
  isAvailableTool,
  monthWindow,
  proposalKeyFor,
  resolveAllowance,
  resolveDailyCap,
  runCostPaise,
  toEnhancementDto,
  type AvailableTool,
  type EnhancementDto,
  type EnhancementProvider,
  type EnhancementRow,
  type EnhancementSettingsDto,
  type EnhancementTransform,
  type EnhancementUsage,
  type OrgEnhancementPolicyView,
  type OrgEnhancementUsage,
  type RequestEnhancementInput,
  type SetOrgEnhancementPolicyInput,
} from "@server/content/enhancement.types";

/**
 * What a tool needs from a provider (trd D3). A tool that needs nothing runs on sharp alone; a
 * scene needs two services and a setting, which is a third case rather than a special one — the
 * table says what each tool asks for and the compiler holds the pipelines to it.
 */
const NEEDS = { NOTHING: "nothing", SEGMENT: "segment", SCENE: "scene" } as const;

/**
 * Each available tool's pipeline (trd D2), and what it asks a provider for. Held complete against
 * the available set by the compiler, and discriminated so a tool that needs something cut out
 * cannot be run without a segmenter to cut it.
 */
type ToolPipeline =
  | { needs: typeof NEEDS.NOTHING; run: (input: ToolInput) => Promise<ToolResult> }
  | { needs: typeof NEEDS.SEGMENT; run: (input: ToolInput, segmenter: Segmenter) => Promise<ToolResult> }
  | {
      needs: typeof NEEDS.SCENE;
      run: (
        input: ToolInput,
        segmenter: Segmenter,
        painter: ScenePainter,
        preset: ScenePreset,
      ) => Promise<ToolResult>;
    };

const TOOLS: Record<AvailableTool, ToolPipeline> = {
  [ENHANCEMENT_TOOL.WHITE]: { needs: NEEDS.SEGMENT, run: onWhite },
  [ENHANCEMENT_TOOL.STUDIO]: { needs: NEEDS.SEGMENT, run: inStudio },
  [ENHANCEMENT_TOOL.SCENE]: { needs: NEEDS.SCENE, run: inScene },
  [ENHANCEMENT_TOOL.CUTOUT]: { needs: NEEDS.SEGMENT, run: cutOut },
  [ENHANCEMENT_TOOL.LIGHT]: { needs: NEEDS.NOTHING, run: (input) => lightFix(input.bytes) },
  // One target for every marketplace, read off the channel rules rather than chosen here.
  [ENHANCEMENT_TOOL.ENLARGE]: {
    needs: NEEDS.NOTHING,
    run: (input) => enlarge({ bytes: input.bytes, targetLongEdge: ENLARGE_TARGET_LONG_EDGE }),
  },
};

/**
 * The tool with its services already chosen, the ledger's name for the one that did the work, and
 * what the run will cost (spec R9). Resolved before any bytes are read, so a tool whose service is
 * not configured — or a scene naming a setting the list no longer has — is refused before a slot is
 * spent and before the store is touched. What the row ends up recording is what actually ran, which
 * may differ from what the request planned if the platform's choice changed in between.
 */
function prepareTool(
  tool: AvailableTool,
  preset: string | null,
  runId?: string,
): {
  provider: EnhancementProvider;
  costPaise: number;
  run: (input: ToolInput) => Promise<ToolResult>;
} {
  const pipeline = TOOLS[tool];
  if (pipeline.needs === NEEDS.NOTHING) {
    const provider = ENHANCEMENT_PROVIDER.SHARP;
    return { provider, costPaise: runCostPaise([{ tool, provider }]), run: pipeline.run };
  }

  const segmenter = segmenterFor();
  if (pipeline.needs === NEEDS.SEGMENT) {
    return {
      provider: segmenter.key,
      costPaise: runCostPaise([{ tool, provider: segmenter.key }]),
      run: (input) => pipeline.run(input, segmenter),
    };
  }

  // A scene buys two things: the cut-out we make ourselves and the setting painted around it. The
  // row records the service that painted, and the cost of everything the run spent (trd D6).
  const setting = scenePresetFor(preset);
  if (!setting) throw new DomainError("Choose one of the scene settings", { field: "preset" });
  const painter = scenePainterFor(runId);
  return {
    provider: painter.key,
    costPaise: runCostPaise([
      { tool: ENHANCEMENT_TOOL.CUTOUT, provider: segmenter.key },
      { tool: ENHANCEMENT_TOOL.SCENE, provider: painter.key },
    ]),
    run: (input) => pipeline.run(input, segmenter, painter, setting),
  };
}

const toDto = (row: EnhancementRow): EnhancementDto => toEnhancementDto(row, mediaAssetService.publicUrlOf);

/**
 * Where one org stands, and what the platform allows today — the three layers resolved once
 * (trd D5). The settings row is read once per call rather than once per question, and beside the
 * two reads that do not depend on it, because a refusal must not cost three round trips.
 */
async function standing(orgId: string, now: Date): Promise<{ usage: EnhancementUsage; dailyCapPaise: number }> {
  const [settings, policy, used] = await Promise.all([
    enhancementSettingsRepository.read(),
    enhancementPolicyRepository.policyFor(orgId),
    enhancementRepository.countUsage(orgId, monthWindow(now)),
  ]);
  return {
    dailyCapPaise: resolveDailyCap(settings?.dailyCapPaise ?? null),
    usage: {
      used,
      allowance: resolveAllowance(policy.monthlyAllowance, settings?.defaultMonthlyAllowance ?? null),
      paused: policy.pausedAt !== null,
      pauseReason: policy.pauseReason,
    },
  };
}

/**
 * An enhancement is a row and a job (image-enhancement trd, approach): the request is refused or
 * recorded in the transaction that enqueues it, the worker runs one tool and proposes an object,
 * and the org member's decision either registers that object as a derived image or deletes it.
 * The source is never touched (spec R3), and every refusal is a `DomainError` the sheet shows.
 */
export const enhancementService = {
  /**
   * The refusals every run shares, the AI tool's included (spec R7, trd D5; improve-with-ai R12): the
   * shop's pause, its month's allowance, and the platform's day. Answers the standing it checked.
   */
  async assertMayRun(orgId: string, now: Date = new Date()): Promise<EnhancementUsage> {
    const { usage, dailyCapPaise } = await standing(orgId, now);
    if (usage.paused) {
      throw new DomainError(`Enhancement is paused for your shop: ${usage.pauseReason ?? "ask the platform owner"}`);
    }
    if (usage.used >= usage.allowance) {
      throw new DomainError(`You have used all ${usage.allowance} enhancements for this month`);
    }
    if ((await enhancementRepository.sumCostPaise(dayWindow(now))) >= dailyCapPaise) {
      throw new DomainError("Enhancement has reached today's limit across the platform. Try again tomorrow.");
    }
    return usage;
  },

  /** The org's standing this month (spec R7): a count of rows in the states that count, never a counter (trd D5). */
  async usage(orgId: string, now: Date = new Date()): Promise<EnhancementUsage> {
    return (await standing(orgId, now)).usage;
  },

  /**
   * Ask for one improvement of one photograph (spec R1, R2). The cheap refusals come first — a tool
   * with no pipeline, the label slot (R5, trd D8) — then the org's pause and allowance and the
   * platform's daily spend (R7, trd D5), then the photo itself, which must be this org's and ready.
   * Only then is the row written, with its job, in one transaction (ADR-0038 D2).
   */
  async request(
    orgId: string,
    requesterId: string | null,
    input: RequestEnhancementInput,
    now: Date = new Date(),
  ): Promise<{ enhancement: EnhancementDto; usage: EnhancementUsage }> {
    const { tool } = input;
    // A paid feature (feature-access D5): refused before any slot is spent. `run`, accept and discard stay free (Q12, Q32).
    await featureAccessService.assert(orgId, FEATURE.IMAGE_ENHANCEMENT);
    // Every one of the six has a pipeline now, so this is a guard against a tool withdrawn from
    // the list later rather than one still being built — which is why it names none of them.
    if (!isAvailableTool(tool)) throw new DomainError("That improvement is not available yet", { field: "tool" });
    if (input.slotRole === SHOT_ROLE.LABEL) {
      throw new DomainError("The label photo is evidence to be read later, so it is never enhanced");
    }
    // Cheap and local: a tool whose service is not set up, or a setting that is not on the list,
    // is refused before a slot is spent.
    const planned = prepareTool(tool, input.preset ?? null).provider;

    const usage = await this.assertMayRun(orgId, now);

    // Another org's photo, or one not ready, is "not found" rather than a hint that it exists.
    const source = await mediaAssetService.findReadyImage(orgId, { assetId: input.sourceAssetId, ref: input.sourceRef });
    if (!source) throw new NotFoundError("Photo not found");

    const row = await prisma.$transaction(async (tx) => {
      const created = await enhancementRepository.create(
        {
          orgId,
          requesterId,
          sourceAssetId: source.id,
          tool,
          preset: input.preset ?? null,
          provider: planned,
          slot: input.slot ?? null,
        },
        tx,
      );
      await enqueue(tx, enhancementSpec, { enhancementId: created.id, orgId });
      return created;
    });
    return { enhancement: toDto(row), usage: { ...usage, used: usage.used + 1 } };
  },

  /** Proposals waiting for the shop's accept or discard: Home's "photos can be improved" line (onboarding Q25). */
  async countAwaitingDecision(orgId: string): Promise<number> {
    return await enhancementRepository.countAwaitingDecision(orgId);
  },

  async get(orgId: string, id: string): Promise<EnhancementDto> {
    const row = await enhancementRepository.findForOrg(orgId, id);
    if (!row) throw new NotFoundError("Enhancement not found");
    return toDto(row);
  },

  /**
   * One run, as the worker performs it (trd D2, D9): take the row, read the source, run the tool,
   * store the proposal under its own key, mark it proposed with its cost. Idempotent on the row
   * (ADR-0038 D4): a row past RUNNING is left alone, and a RUNNING one is resumed, since the tools
   * are deterministic and the key fixed. A `DomainError` is the org member's to read and fails the
   * run (spec R10); anything else may be transient and is the queue's to retry.
   */
  async run(enhancementId: string, jobId = "direct", now: Date = new Date()): Promise<void> {
    const row = await enhancementRepository.findById(enhancementId);
    if (!row || (row.state !== ENHANCEMENT_STATE.REQUESTED && row.state !== ENHANCEMENT_STATE.RUNNING)) {
      console.log(`[jobs] image.enhance ${jobId}: ${enhancementId} is not awaiting a run; nothing to do`);
      return;
    }
    if (!(await enhancementRepository.markRunning(row.id))) return;

    try {
      if (!isAvailableTool(row.tool)) throw new DomainError("That improvement is not available yet");
      const { provider, costPaise, run } = prepareTool(row.tool, row.preset, row.id);
      const source = await mediaAssetService.readImageBytes(row.sourceAssetId);
      const result = await run(source);
      const proposalKey = proposalKeyFor(row.id, row.tool);
      await mediaAssetService.putLooseObject(proposalKey, result.output, result.mimeType);
      // What a model charged is its generation row's, priced at that day's rate (generation-foundation trd D7).
      const generated = await generationRepository.costForEnhancement(row.id);
      await enhancementRepository.markProposed(row.id, {
        proposalKey,
        provider,
        costPaise: costPaise + generated,
        proposedAt: now,
      });
      console.log(`[jobs] image.enhance ${jobId}: ${enhancementId} proposed (${row.tool}, ${result.width}x${result.height})`);
    } catch (error) {
      if (error instanceof DomainError) {
        // The shop is not charged a run that failed; the platform's day still counts a paint it paid for.
        await enhancementRepository.markFailed(row.id, error.message, await generationRepository.costForEnhancement(row.id));
        console.log(`[jobs] image.enhance ${jobId}: ${enhancementId} failed — ${error.message}`);
        return;
      }
      console.error(`[jobs] image.enhance ${jobId}: ${enhancementId} errored, will retry`, error);
      throw error;
    }
  },

  /**
   * Keep the proposal (spec R3): it is copied beside its source and registered as a READY DERIVED
   * image carrying what made it, then the row is decided. The copy happens first, so a decided row
   * always names a real image; a double tap finds the row decided and is refused.
   */
  async accept(orgId: string, id: string, now: Date = new Date()): Promise<EnhancementDto> {
    const row = await enhancementRepository.findForOrg(orgId, id);
    if (!row) throw new NotFoundError("Enhancement not found");
    if (row.state === ENHANCEMENT_STATE.ACCEPTED) return toDto(row);
    if (row.state !== ENHANCEMENT_STATE.PROPOSED || !row.proposalKey) {
      throw new ConflictError("There is no proposal to accept");
    }

    const transform: EnhancementTransform = { tool: row.tool, preset: row.preset, provider: row.provider, enhancementId: row.id };
    const result = await mediaAssetService.registerDerivedObject({
      orgId,
      uploaderId: row.requesterId,
      sourceAssetId: row.sourceAssetId,
      fromKey: row.proposalKey,
      fileSuffix: `${row.tool.toLowerCase()}-${row.id}.${PROPOSAL_EXTENSION[TOOL_MIME_TYPE[row.tool]]}`,
      contentType: TOOL_MIME_TYPE[row.tool],
      transform,
    });
    const moved = await enhancementRepository.markAccepted(row.id, { resultAssetId: result.id, decidedAt: now });
    if (!moved) throw new ConflictError("This proposal was already decided");

    // The accepted image is real now; losing this delete costs a stray object, never the decision.
    try {
      await mediaAssetService.deleteLooseObject(row.proposalKey);
    } catch (error) {
      console.error(`[enhancement] proposal ${row.proposalKey} could not be deleted after acceptance`, error);
    }
    return toDto((await enhancementRepository.findForOrg(orgId, id)) ?? row);
  },

  /** Let the proposal go (spec R3, A8): the object is deleted first, so a discarded run leaves no trace. */
  async discard(orgId: string, id: string, now: Date = new Date()): Promise<EnhancementDto> {
    const row = await enhancementRepository.findForOrg(orgId, id);
    if (!row) throw new NotFoundError("Enhancement not found");
    if (row.state === ENHANCEMENT_STATE.DISCARDED) return toDto(row);
    if (row.state !== ENHANCEMENT_STATE.PROPOSED) throw new ConflictError("There is no proposal to discard");

    if (row.proposalKey) await mediaAssetService.deleteLooseObject(row.proposalKey);
    const moved = await enhancementRepository.markDiscarded(row.id, now);
    if (!moved) throw new ConflictError("This proposal was already decided");
    return toDto((await enhancementRepository.findForOrg(orgId, id)) ?? row);
  },

  // ── What the platform owner sets and reads (spec R7, trd D5) ──────────────────────────────

  /** The platform's two numbers as they stand, and whether a row holds them or they are the fallbacks. */
  async settings(): Promise<EnhancementSettingsDto> {
    const row = await enhancementSettingsRepository.read();
    return {
      defaultMonthlyAllowance: resolveAllowance(null, row?.defaultMonthlyAllowance ?? null),
      dailyCapPaise: resolveDailyCap(row?.dailyCapPaise ?? null),
      configured: row !== null,
    };
  },

  async saveSettings(input: SaveEnhancementSettingsInput): Promise<EnhancementSettingsDto> {
    const row = await enhancementSettingsRepository.save(input);
    return {
      defaultMonthlyAllowance: row.defaultMonthlyAllowance,
      dailyCapPaise: row.dailyCapPaise,
      configured: true,
    };
  },

  /** One org's standing, with its own number beside the resolved one, for the form that sets it. */
  async policyFor(orgId: string): Promise<OrgEnhancementPolicyView> {
    const [settings, policy] = await Promise.all([
      enhancementSettingsRepository.read(),
      enhancementPolicyRepository.policyFor(orgId),
    ]);
    return {
      monthlyAllowance: resolveAllowance(policy.monthlyAllowance, settings?.defaultMonthlyAllowance ?? null),
      monthlyAllowanceOverride: policy.monthlyAllowance,
      paused: policy.pausedAt !== null,
      pauseReason: policy.pauseReason,
    };
  },

  /**
   * Record what this org does differently, or stop recording anything (trd D5). A row that says
   * neither "a different allowance" nor "paused" is a copy of the platform's number waiting to go
   * stale, so it is deleted rather than written. The existing `pausedAt` is kept where there is
   * one: editing an allowance is not a new pause, and the timestamp says when the pause began.
   */
  async setOrgPolicy(
    orgId: string,
    input: SetOrgEnhancementPolicyInput,
    now: Date = new Date(),
  ): Promise<OrgEnhancementPolicyView> {
    if (input.monthlyAllowance === null && !input.paused) {
      await enhancementPolicyRepository.remove(orgId);
    } else {
      const current = await enhancementPolicyRepository.policyFor(orgId);
      await enhancementPolicyRepository.save(orgId, {
        monthlyAllowance: input.monthlyAllowance,
        pausedAt: input.paused ? (current.pausedAt ?? now) : null,
        pauseReason: input.paused ? input.pauseReason : null,
      });
    }
    return await this.policyFor(orgId);
  },

  /**
   * Every org with something to show this month: one that enhanced, or one the owner has already
   * said something about (spec R7). Three queries and never one per org — the grouped counts, the
   * deviations, and then the names for the ids those two produced.
   */
  async listOrgUsage({ month = new Date() }: { month?: Date } = {}): Promise<OrgEnhancementUsage[]> {
    const [settings, usage, policies] = await Promise.all([
      enhancementSettingsRepository.read(),
      enhancementRepository.usageByOrg(monthWindow(month)),
      enhancementPolicyRepository.list(),
    ]);

    const ids = [...new Set([...usage.map((row) => row.orgId), ...policies.map((row) => row.orgId)])];
    const orgs = await adminOrgService.summariesFor(ids);
    const usageById = new Map(usage.map((row) => [row.orgId, row]));
    const policyById = new Map(policies.map((row) => [row.orgId, row]));

    return orgs
      .map((org) => {
        const policy = policyById.get(org.id);
        const counted = usageById.get(org.id);
        return {
          orgId: org.id,
          name: org.name,
          code: org.code,
          used: counted?.used ?? 0,
          spentPaise: counted?.spentPaise ?? 0,
          monthlyAllowance: resolveAllowance(
            policy?.monthlyAllowance ?? null,
            settings?.defaultMonthlyAllowance ?? null,
          ),
          monthlyAllowanceOverride: policy?.monthlyAllowance ?? null,
          paused: policy?.pausedAt != null,
          pauseReason: policy?.pauseReason ?? null,
        };
      })
      .sort((a, b) => b.used - a.used || a.name.localeCompare(b.name));
  },

  /** What every org together has spent today, in paise — the number the cap is read against. */
  async platformSpendToday(now: Date = new Date()): Promise<number> {
    return await enhancementRepository.sumCostPaise(dayWindow(now));
  },

  /**
   * What the free tools cost the platform this month past the host's free allowance (ai-images Q16;
   * generation-foundation trd D11). A query, never a counter. Paise is null when no exchange rate
   * has ever been stored — the count still shows.
   */
  async absorbedThisMonth(now: Date = new Date()): Promise<{ cutouts: number; over: number; paise: number | null }> {
    const cutouts = await enhancementRepository.countHostCutouts(monthWindow(now), SEGMENTING_TOOLS, ENHANCEMENT_PROVIDER.MODEL);
    const over = Math.max(0, cutouts - FREE_CUTOUTS_PER_MONTH);
    // The stored rate only: an admin page render never fetches from outside (review, 2026-11-21).
    const rate = over > 0 ? await exchangeRateRepository.latestOnOrBefore(now) : null;
    const paise = over === 0 ? 0 : rate ? microUsdToPaise(over * CUTOUT_OVERAGE_MICRO_USD, rate.paisePerUsd) : null;
    return { cutouts, over, paise };
  },
};
