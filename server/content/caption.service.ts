import { randomUUID } from "node:crypto";
import { ConflictError, DomainError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import { canonicalJson, sha256Hex } from "@server/shared/hash";
import { productService } from "@server/catalog/product.service";
import { adminOrgService } from "@server/catalog/org.service";
import { categoryRepository } from "@server/catalog/category.read.repository";
import { FACT } from "@server/listing/listing-facts";
import { loadPriceContext, resolveProductPrice } from "@server/promotions/price-context";
import { creditService } from "@server/payouts/credit.service";
import { CREDIT_RUN } from "@server/payouts/credit.types";
import { generationRepository } from "@server/content/generation.repository";
import { captionDraftRepository } from "@server/content/caption-draft.repository";
import { GenerationFailure, TEXT_PURPOSE } from "@server/content/generation/generation.types";
import { generateText, quoteText } from "@server/content/generation/text-generator";
import { captionPrompt } from "@server/content/generation/prompts";
import {
  checkCaption,
  formatRupees,
  mergeStated,
  priceChangesBetween,
  restated,
  rewritePrices,
  statesPrice,
  templateCaption,
  type LivePrice,
} from "@server/content/caption/rules";
import {
  CAPTION_COPY,
  CAPTION_MAX_CHARS,
  CAPTION_MAX_HASHTAGS,
  CAPTION_SOURCE,
  type CaptionDraftDto,
  type CaptionFacts,
  type CaptionLanguage,
  type CaptionPriceChangeDto,
  type CaptionProductFacts,
} from "@server/content/caption.types";

/**
 * Write a caption (ai-images/social-posts D3–D5; Q47): drafted from the post's products' live facts,
 * checked before the shop sees it, recorded so a later price change is caught. Content never writes
 * the post: the caller puts the caption where it belongs (social owns `Post`).
 */

/** Enough for a caption in two languages; the quote is made at this bound (D5). */
export const CAPTION_MAX_OUTPUT_TOKENS = 1_200;
/** A rejected draft is asked for once more, then the template is used (D3). */
export const CAPTION_ATTEMPTS = 2;
const CAPTION_RUN_PREFIX = "caption-";
/** A caption run still holding credit after this long had its process die; the next request closes it. */
export const CAPTION_STALE_MS = 10 * 60 * 1000;

const attemptKeys = (runId: string) => Array.from({ length: CAPTION_ATTEMPTS }, (_, i) => `${runId}:${i + 1}`);

/** Close a run's hold at what its drafts cost; spend is read from the ledger rows, so a billed failure still counts. */
async function closeRun(runId: string): Promise<void> {
  const spent = await generationRepository.costForKeys(attemptKeys(runId));
  if (spent > 0) await creditService.settle(runId, spent, CREDIT_RUN.CAPTION);
  else await creditService.refund(runId, CREDIT_RUN.CAPTION);
}

const factText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : Array.isArray(value) && value.length > 0 ? value.map(String).join(", ") : null;

async function livePrices(productIds: readonly string[]): Promise<Map<string, LivePrice>> {
  const [rows, context] = await Promise.all([productService.checkoutFacts([...productIds]), loadPriceContext()]);
  return new Map(
    rows.map((row) => {
      const { pricePaise, offerPricePaise } = resolveProductPrice(row, context);
      return [row.id, { pricePaise, effectivePricePaise: Math.min(pricePaise, offerPricePaise) }];
    }),
  );
}

/** The facts of the shop's own products, in the post's order; another shop's are never read. */
async function liveFacts(orgId: string, productIds: readonly string[], language: CaptionLanguage): Promise<CaptionFacts> {
  const [rows, context, [org]] = await Promise.all([
    productService.forListing(orgId, productIds),
    loadPriceContext(),
    adminOrgService.summariesFor([orgId]),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const products: CaptionProductFacts[] = [];
  for (const id of productIds) {
    const row = byId.get(id);
    if (!row) continue;
    const { pricePaise, offerPricePaise, offerLabel } = resolveProductPrice(row, context);
    const category = await categoryRepository.findById(row.categoryId);
    products.push({
      productId: row.id,
      name: row.name,
      pricePaise,
      offerPricePaise: offerPricePaise < pricePaise ? offerPricePaise : null,
      offerLabel: offerPricePaise < pricePaise ? offerLabel : null,
      category: category?.name ?? null,
      material: factText(row.facts[FACT.MATERIAL]),
    });
  }
  if (products.length === 0) throw new DomainError(CAPTION_COPY.needsProduct, { field: "productIds" });
  return { shopName: org?.name ?? "", language, products };
}

const promptOf = (facts: CaptionFacts) =>
  captionPrompt(
    {
      shopName: facts.shopName,
      language: facts.language,
      products: facts.products.map((p) => ({
        name: p.name,
        price: formatRupees(p.pricePaise),
        offerPrice: p.offerPricePaise === null ? null : formatRupees(p.offerPricePaise),
        offer: p.offerLabel,
        category: p.category,
        material: p.material,
      })),
    },
    { maxChars: CAPTION_MAX_CHARS, maxHashtags: CAPTION_MAX_HASHTAGS },
  );

/**
 * Up to two model drafts under one credit hold, settled to what they cost. Null when no model is set
 * up or none wrote a caption that passed; the caller then uses the template.
 */
async function modelDraft(orgId: string, facts: CaptionFacts): Promise<{ text: string; generationId: string } | null> {
  const prompt = promptOf(facts);
  const quoted = await quoteText(TEXT_PURPOSE.CAPTION, prompt.text, CAPTION_MAX_OUTPUT_TOKENS).catch((cause: unknown) => {
    if (!(cause instanceof GenerationFailure)) throw cause;
    console.warn(`[caption] no quote (${cause.message}); the template is used`);
    return null;
  });
  if (!quoted) return null;

  const runId = `${CAPTION_RUN_PREFIX}${randomUUID()}`;
  const marginBps = await creditService.marginFor(orgId);
  await prisma.$transaction(async (tx) => {
    await creditService.charge(tx, {
      orgId,
      enhancementId: runId,
      costPaise: quoted.first.costPaise,
      worstCostPaise: quoted.worstCostPaise * CAPTION_ATTEMPTS,
      marginBps,
      run: CREDIT_RUN.CAPTION,
    });
  });
  try {
    for (const key of attemptKeys(runId)) {
      const result = await generateText({
        purpose: TEXT_PURPOSE.CAPTION,
        prompt: prompt.text,
        promptVersion: prompt.version,
        maxOutputTokens: CAPTION_MAX_OUTPUT_TOKENS,
        idempotencyKey: key,
      });
      const checked = checkCaption(result.text, facts);
      if (checked.ok) return { text: checked.text, generationId: result.generationId };
      console.warn(`[caption] ${result.generationId} rejected: ${checked.reason}`);
    }
    return null;
  } catch (cause) {
    if (!(cause instanceof GenerationFailure)) throw cause;
    console.warn(`[caption] ${runId}: ${cause.message}; the template is used`);
    return null;
  } finally {
    await closeRun(runId);
  }
}

export const captionService = {
  /** Write a caption for a post's products (journey 4). The shop's credit pays for the model's drafts. */
  async write(orgId: string, input: { postId: string; productIds: string[]; language: CaptionLanguage }): Promise<CaptionDraftDto> {
    if (input.productIds.length === 0) throw new DomainError(CAPTION_COPY.needsProduct, { field: "productIds" });
    // A lazy sweep, as pictures have: a hold a dead process left open is closed before a new one is taken.
    for (const runId of await creditService.openRuns(orgId, CAPTION_RUN_PREFIX, new Date(Date.now() - CAPTION_STALE_MS))) {
      await closeRun(runId);
    }
    const facts = await liveFacts(orgId, input.productIds, input.language);
    const drafted = await modelDraft(orgId, facts);
    const caption = drafted?.text ?? templateCaption(facts);
    const stated = mergeStated(await captionDraftRepository.find(input.postId), {
      productIds: facts.products.map((p) => p.productId),
      pricesPaise: facts.products.map((p) => p.pricePaise),
      effectivePricesPaise: facts.products.map((p) => p.offerPricePaise ?? p.pricePaise),
    });
    await captionDraftRepository.record(input.postId, {
      ...stated,
      factsHash: sha256Hex(Buffer.from(canonicalJson(facts))),
      language: input.language,
      generationId: drafted?.generationId ?? null,
    });
    return { caption, source: drafted ? CAPTION_SOURCE.MODEL : CAPTION_SOURCE.TEMPLATE, language: input.language };
  },

  /** The drafted prices this caption still states that the products no longer have (journey 5). */
  async priceChanges(postId: string, caption: string): Promise<CaptionPriceChangeDto[]> {
    const recorded = await captionDraftRepository.find(postId);
    if (!recorded) return [];
    const changes = priceChangesBetween(recorded, await livePrices(recorded.productIds));
    return changes.filter((change) => statesPrice(caption, change.wasPaise));
  },

  /**
   * Whether a post's caption may go out as it is (D4; post-composer D6): false while it states a
   * drafted price its product no longer has. A caption never drafted here is the shop's own words.
   */
  async captionStillTrue(postId: string, caption: string): Promise<boolean> {
    return (await this.priceChanges(postId, caption)).length === 0;
  },

  /**
   * Update price: the caption with each stale price swapped for today's, nothing else changed. Writes
   * nothing. A change a swap cannot make true (an offer that ended, an amount another price shares) is a 409.
   */
  async withLivePrices(postId: string, caption: string): Promise<{ caption: string; changes: CaptionPriceChangeDto[] }> {
    const changes = await this.priceChanges(postId, caption);
    if (changes.some((change) => !change.rewritable)) throw new ConflictError(CAPTION_COPY.writeAgain);
    return { caption: rewritePrices(caption, changes), changes };
  },

  /**
   * Once the rewritten caption is saved, the draft records the prices it wrote, so a further change is
   * caught too. After the save: were it before and the save lost, the old price would hide.
   */
  async restateWritten(postId: string, changes: readonly CaptionPriceChangeDto[]): Promise<void> {
    const recorded = await captionDraftRepository.find(postId);
    if (recorded) await captionDraftRepository.restate(postId, restated(recorded, changes));
  },
};
