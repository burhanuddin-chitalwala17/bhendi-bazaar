import sharp from "sharp";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { creditService } from "@server/payouts/credit.service";
import { enhancementRepository } from "@server/content/enhancement.repository";
import { enhancementService } from "@server/content/enhancement.service";
import { enhancementSpec } from "@server/content/enhancement.job";
import { generationRepository } from "@server/content/generation.repository";
import {
  ENHANCEMENT_PROVIDER,
  ENHANCEMENT_STATE,
  ENHANCEMENT_TOOL,
  PROPOSAL_MIME,
  STYLED_FACE,
  proposalKeyFor,
  toEnhancementDto,
  type EnhancementDto,
  type EnhancementUsage,
  type RequestStyledInput,
  type StyledFace,
  type StyledQuoteDto,
} from "@server/content/enhancement.types";
import {
  GENERATION_ASPECT,
  GENERATION_FAILURE,
  GENERATION_PURPOSE,
  GENERATION_SIZE,
  GenerationFailure,
} from "@server/content/generation/generation.types";
import { generate, quoteRange } from "@server/content/generation/generator";
import { listingPrompt } from "@server/content/generation/prompts";
import { WEBP_QUALITY } from "@server/content/tools/tool";

/**
 * Improve with AI (ai-images/improve-with-ai D1–D6): a seventh tool on the enhancement ledger, so the
 * lock, pause, allowance, daily cap and accept-as-derived all apply. Its own file, so the enhancement
 * service gains no reason to know about credit (ADR-0036).
 */

/** A listing picture is square: what every marketplace's gallery takes. */
const ASPECT = GENERATION_ASPECT.SQUARE;
const SIZE = GENERATION_SIZE.S1K;

export const STYLED_REFUSED_MESSAGE =
  "This description could not be made into a picture. Try describing it differently — nothing was charged.";
export const STYLED_FAILED_MESSAGE = "The picture could not be made just now. Nothing was charged.";
const NOT_SET_UP = "AI pictures are not set up yet";

/** A run still failing after this long is given up and refunded, not retried again (D6). */
export const STYLED_GIVE_UP_MS = 20 * 60 * 1000;
/** A run whose job is lost altogether is closed the next time the shop asks for a picture. */
export const STYLED_STALE_MS = 2 * 60 * 60 * 1000;

/** Fail a run in the shop's words and give its credit back; both are idempotent. */
async function failAndRefund(id: string, message: string): Promise<void> {
  await enhancementRepository.markFailed(id, message, await generationRepository.costForEnhancement(id));
  await creditService.refund(id);
}

const toDto = (row: Parameters<typeof toEnhancementDto>[0]): EnhancementDto =>
  toEnhancementDto(row, mediaAssetService.publicUrlOf);

/** The quote for this many pictures to follow, the photo itself counted, or a refusal the modal can show. */
async function range(references: number) {
  const quoted = await quoteRange(GENERATION_PURPOSE.LISTING, { references, aspect: ASPECT, size: SIZE }).catch((cause: unknown) => {
    throw new DomainError(NOT_SET_UP, { cause });
  });
  if (!quoted) throw new DomainError(NOT_SET_UP);
  return quoted;
}

export const styledService = {
  /** The cost line and the reference limit (D4): the server's numbers, never the browser's. */
  async quote(orgId: string, extraReferences: number): Promise<StyledQuoteDto> {
    const quoted = await range(1 + extraReferences);
    const [{ chargePaise }, { chargePaise: heldPaise }, account] = await Promise.all([
      creditService.priceFor(orgId, quoted.first.costPaise),
      creditService.priceFor(orgId, quoted.worstCostPaise),
      creditService.account(orgId),
    ]);
    return {
      chargePaise,
      heldPaise,
      balancePaise: account.balancePaise,
      maxExtraReferences: Math.max(0, quoted.first.maxReferences - 1),
    };
  },

  /**
   * Ask for one AI picture (D3). The shared refusals first (R12), then the photos — the shop's own and
   * ready — then the quote, then one transaction: the row, the credit hold, the job.
   */
  async request(
    orgId: string,
    requesterId: string | null,
    input: RequestStyledInput,
    now: Date = new Date(),
  ): Promise<{ enhancement: EnhancementDto; usage: EnhancementUsage }> {
    const usage = await enhancementService.assertMayRun(orgId, now);
    // A lazy sweep (D6): any of this shop's runs whose job was lost gives its hold back first.
    for (const stale of await enhancementRepository.findStale(orgId, ENHANCEMENT_TOOL.STYLED, new Date(now.getTime() - STYLED_STALE_MS))) {
      await failAndRefund(stale.id, STYLED_FAILED_MESSAGE);
    }

    const source = await mediaAssetService.findReadyImage(orgId, { assetId: input.sourceAssetId, ref: input.sourceRef });
    if (!source) throw new NotFoundError("Photo not found");
    const references: Array<NonNullable<Awaited<ReturnType<typeof mediaAssetService.findReadyImage>>>> = [];
    for (const ref of new Set(input.referenceRefs)) {
      const found = await mediaAssetService.findReadyImage(orgId, { ref });
      if (!found) throw new NotFoundError("A reference picture was not found in your library", { field: "referenceRefs" });
      if (found.id !== source.id) references.push(found);
    }
    if (input.previousId) {
      const previous = await enhancementRepository.findForOrg(orgId, input.previousId);
      if (!previous || previous.tool !== ENHANCEMENT_TOOL.STYLED) throw new NotFoundError("Earlier picture not found");
    }

    const quoted = await range(1 + references.length);
    if (references.length > quoted.first.maxReferences - 1) {
      throw new DomainError(`This picture can follow at most ${quoted.first.maxReferences - 1} more pictures`, {
        field: "referenceRefs",
      });
    }
    const marginBps = await creditService.marginFor(orgId);

    const row = await prisma.$transaction(async (tx) => {
      const created = await enhancementRepository.create(
        {
          orgId,
          requesterId,
          sourceAssetId: source.id,
          tool: ENHANCEMENT_TOOL.STYLED,
          preset: input.face,
          provider: ENHANCEMENT_PROVIDER.GENERATION,
          slot: input.slot ?? null,
          brief: input.brief,
          referenceRefs: references.map((reference) => reference.ref),
          previousId: input.previousId ?? null,
        },
        tx,
      );
      await creditService.charge(tx, {
        orgId,
        enhancementId: created.id,
        costPaise: quoted.first.costPaise,
        worstCostPaise: quoted.worstCostPaise,
        marginBps,
      });
      await enqueue(tx, enhancementSpec, { enhancementId: created.id, orgId });
      return created;
    });
    // What was followed once can be followed again (media-tags R7); losing this costs a tag, never the run.
    await mediaAssetService.tagAsReference(orgId, references.map((reference) => reference.id)).catch((error: unknown) => {
      console.error(`[styled] reference tags for ${row.id} not written`, error);
    });
    return { enhancement: toDto(row), usage: { ...usage, used: usage.used + 1 } };
  },

  /**
   * One run, as the worker performs it (D6). Answers false for a run that is not a styled one, which
   * the job then hands to the six tools' path. Every picture is kept: proposed and accepted in the
   * same run (Q25), then the credit is settled to what the model that answered cost.
   */
  async run(enhancementId: string, jobId = "direct", now: Date = new Date()): Promise<boolean> {
    const row = await enhancementRepository.findById(enhancementId);
    if (!row || row.tool !== ENHANCEMENT_TOOL.STYLED) return false;
    if (row.state !== ENHANCEMENT_STATE.REQUESTED && row.state !== ENHANCEMENT_STATE.RUNNING) {
      // A redelivered or recovered run finishes what the last one started: keep, then settle; or
      // refund a failed one. Each step is idempotent, so a run that got further changes nothing.
      if (row.state === ENHANCEMENT_STATE.PROPOSED) await enhancementService.accept(row.orgId, row.id, now);
      if (row.state === ENHANCEMENT_STATE.PROPOSED || row.state === ENHANCEMENT_STATE.ACCEPTED) {
        await creditService.settle(row.id, await generationRepository.costForEnhancement(row.id));
      }
      if (row.state === ENHANCEMENT_STATE.FAILED) await creditService.refund(row.id);
      return true;
    }
    if (!(await enhancementRepository.markRunning(row.id))) return true;

    try {
      const source = await mediaAssetService.readImageBytes(row.sourceAssetId);
      const references = [{ bytes: source.bytes, mimeType: source.mimeType ?? "image/jpeg", assetId: row.sourceAssetId }];
      for (const ref of row.referenceRefs) {
        const found = await mediaAssetService.findReadyImage(row.orgId, { ref });
        if (!found) continue;
        const bytes = await mediaAssetService.readImageBytes(found.id);
        references.push({ bytes: bytes.bytes, mimeType: bytes.mimeType ?? "image/jpeg", assetId: found.id });
      }
      const face: StyledFace = row.preset === STYLED_FACE.WITH_FACE ? STYLED_FACE.WITH_FACE : STYLED_FACE.NO_FACE;
      const prompt = listingPrompt(face, row.brief ?? "");
      const result = await generate(
        {
          purpose: GENERATION_PURPOSE.LISTING,
          prompt: prompt.text,
          promptVersion: prompt.version,
          brief: row.brief,
          references,
          aspect: ASPECT,
          size: SIZE,
          idempotencyKey: `enhancement:${row.id}:styled`,
          // A listing picture may show a person; recorded so publishing can tag it (handoff, compliance).
          containsPerson: true,
          enhancementId: row.id,
        },
        now,
      );
      const [image] = result.images;
      if (!image) throw new DomainError(STYLED_FAILED_MESSAGE);
      const output = await sharp(image).webp({ quality: WEBP_QUALITY }).toBuffer();
      const proposalKey = proposalKeyFor(row.id, row.tool);
      await mediaAssetService.putLooseObject(proposalKey, output, PROPOSAL_MIME.WEBP);
      const spent = await generationRepository.costForEnhancement(row.id);
      await enhancementRepository.markProposed(row.id, {
        proposalKey,
        provider: ENHANCEMENT_PROVIDER.GENERATION,
        costPaise: spent,
        proposedAt: now,
      });
      await enhancementService.accept(row.orgId, row.id, now);
      await creditService.settle(row.id, spent);
      console.log(`[jobs] image.enhance ${jobId}: ${row.id} styled by ${result.modelId}`);
      return true;
    } catch (error) {
      const message =
        error instanceof GenerationFailure
          ? error.kind === GENERATION_FAILURE.REFUSED
            ? STYLED_REFUSED_MESSAGE
            : STYLED_FAILED_MESSAGE
          : error instanceof DomainError
            ? error.message
            : null;
      if (message === null) {
        // Transient until it has failed for long enough; then given up, so a hold never stays open.
        if (now.getTime() - row.createdAt.getTime() < STYLED_GIVE_UP_MS) {
          console.error(`[jobs] image.enhance ${jobId}: ${row.id} errored, will retry`, error);
          throw error;
        }
        console.error(`[jobs] image.enhance ${jobId}: ${row.id} errored past its deadline, giving up`, error);
        await failAndRefund(row.id, STYLED_FAILED_MESSAGE);
        return true;
      }
      await failAndRefund(row.id, message);
      console.log(`[jobs] image.enhance ${jobId}: ${row.id} failed — ${message}`);
      return true;
    }
  },
};
