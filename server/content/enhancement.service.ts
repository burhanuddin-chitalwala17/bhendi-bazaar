import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { SHOT_ROLE } from "@server/catalog/shot-list";
import { enhancementRepository } from "@server/content/enhancement.repository";
import { enhancementPolicyRepository } from "@server/content/enhancement-policy.repository";
import { enhancementSpec } from "@server/content/enhancement.job";
import { lightFix, type ToolResult } from "@server/content/tools/light";
import {
  ENHANCEMENT_DAILY_CAP_PAISE,
  ENHANCEMENT_STATE,
  ENHANCEMENT_TOOL,
  PROPOSAL_EXTENSION,
  PROPOSAL_MIME_TYPE,
  TOOL_COPY,
  TOOL_COST_PAISE,
  TOOL_PROVIDER,
  dayWindow,
  isAvailableTool,
  monthWindow,
  proposalKeyFor,
  toEnhancementDto,
  type AvailableTool,
  type EnhancementDto,
  type EnhancementRow,
  type EnhancementTransform,
  type EnhancementUsage,
  type RequestEnhancementInput,
} from "@server/content/enhancement.types";

/** Each available tool's pipeline (trd D2). Held complete against the available set by the compiler. */
const TOOLS: Record<AvailableTool, (input: Buffer) => Promise<ToolResult>> = {
  [ENHANCEMENT_TOOL.LIGHT]: lightFix,
};

const toDto = (row: EnhancementRow): EnhancementDto => toEnhancementDto(row, mediaAssetService.publicUrlOf);

/**
 * An enhancement is a row and a job (image-enhancement trd, approach): the request is refused or
 * recorded in the transaction that enqueues it, the worker runs one tool and proposes an object,
 * and the org member's decision either registers that object as a derived image or deletes it.
 * The source is never touched (spec R3), and every refusal is a `DomainError` the sheet shows.
 */
export const enhancementService = {
  /** The org's standing this month (spec R7): a count of rows in the states that count, never a counter (trd D5). */
  async usage(orgId: string, now: Date = new Date()): Promise<EnhancementUsage> {
    const [policy, used] = await Promise.all([
      enhancementPolicyRepository.policyFor(orgId),
      enhancementRepository.countUsage(orgId, monthWindow(now)),
    ]);
    return { used, allowance: policy.monthlyAllowance, paused: policy.pausedAt !== null, pauseReason: policy.pauseReason };
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
    if (!isAvailableTool(tool)) {
      throw new DomainError(`${TOOL_COPY[tool].label} is not available yet`, { field: "tool" });
    }
    if (input.slotRole === SHOT_ROLE.LABEL) {
      throw new DomainError("The label photo is evidence to be read later, so it is never enhanced");
    }

    const usage = await this.usage(orgId, now);
    if (usage.paused) {
      throw new DomainError(`Enhancement is paused for your shop: ${usage.pauseReason ?? "ask the platform owner"}`);
    }
    if (usage.used >= usage.allowance) {
      throw new DomainError(`You have used all ${usage.allowance} enhancements for this month`);
    }
    if ((await enhancementRepository.sumCostPaise(dayWindow(now))) >= ENHANCEMENT_DAILY_CAP_PAISE) {
      throw new DomainError("Enhancement has reached today's limit across the platform. Try again tomorrow.");
    }

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
          provider: TOOL_PROVIDER[tool],
          slot: input.slot ?? null,
        },
        tx,
      );
      await enqueue(tx, enhancementSpec, { enhancementId: created.id, orgId });
      return created;
    });
    return { enhancement: toDto(row), usage: { ...usage, used: usage.used + 1 } };
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
      if (!isAvailableTool(row.tool)) throw new DomainError(`${TOOL_COPY[row.tool].label} is not available yet`);
      const source = await mediaAssetService.readImageBytes(row.sourceAssetId);
      const result = await TOOLS[row.tool](source.bytes);
      const proposalKey = proposalKeyFor(row.id);
      await mediaAssetService.putLooseObject(proposalKey, result.output, result.mimeType);
      await enhancementRepository.markProposed(row.id, { proposalKey, costPaise: TOOL_COST_PAISE[row.tool], proposedAt: now });
      console.log(`[jobs] image.enhance ${jobId}: ${enhancementId} proposed (${row.tool}, ${result.width}x${result.height})`);
    } catch (error) {
      if (error instanceof DomainError) {
        await enhancementRepository.markFailed(row.id, error.message);
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
      fileSuffix: `${row.tool.toLowerCase()}-${row.id}.${PROPOSAL_EXTENSION}`,
      contentType: PROPOSAL_MIME_TYPE,
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
};
