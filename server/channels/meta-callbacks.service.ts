import { createHmac, randomInt } from "node:crypto";
import { z } from "zod";
import { encryptSecret, decryptSecret } from "@server/shared/crypto";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { prisma } from "@server/shared/prisma";
import { appUrl } from "@server/shared/app-url";
import { ROUTES } from "@server/shared/routes";
import { allForgetters } from "@server/shared/social-events/forget";
import { channelConnectionRepository } from "./channel-connection.repository";
import { connectionPassesRepository } from "./channel-connection-passes.repository";
import { CONNECTION_ERROR } from "./channel-connection.types";
import { dataDeletionRepository, DELETION_STATE } from "./data-deletion.repository";
import { deletePersonSpec } from "./data-deletion.job";
import { metaUnroutedRepository } from "./meta-unrouted.repository";
import { readSignedRequest } from "./providers/meta/signed-request";
import { metaConfigured, signingSecrets, type MetaProduct } from "./providers/meta/settings";
import { SOCIAL_PLATFORM } from "./social/types";

/**
 * Meta's two account callbacks (meta-foundation D6, D7): an app removed inside Instagram, and a
 * person asking that we delete what we hold about them. Both arrive as signed requests.
 */

/** No 0/O or 1/I/L: a person may read the code aloud or type it from a screenshot. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 12;
/** What the status page promises; raw events age out in 30 days too (social-selling TRD A-D15). */
export const DELETION_DAYS = 30;

const PRODUCT = z.enum([SOCIAL_PLATFORM.INSTAGRAM, SOCIAL_PLATFORM.WHATSAPP]);

export class SignedRequestRefused extends Error {
  constructor() {
    super("The signed request did not verify");
    this.name = "SignedRequestRefused";
  }
}

function newCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** The table names nobody: the id is kept as a keyed hash, and sealed only for the job to use. */
const userIdHash = (product: MetaProduct, userId: string) => createHmac("sha256", signingSecrets(product)[0]).update(`${product}:${userId}`).digest("hex");

/**
 * Instagram's callbacks are signed with its own secret, the rest with the Meta app's. A product this
 * deployment has no settings for is skipped, so either platform's callbacks work alone (R10).
 */
/** Awaited, so the count is written before the answer; a failed count is logged, never refuses Meta. */
async function countPrevious(product: MetaProduct): Promise<void> {
  try {
    await metaUnroutedRepository.add(new Date().toISOString().slice(0, 10), product, "previousSecret", 1);
  } catch (error) {
    console.error(JSON.stringify({ scope: "meta.callback", step: "count-previous", error: (error as Error | null)?.name ?? "unknown" }));
  }
}

async function verify(raw: string, products: readonly MetaProduct[]): Promise<{ product: MetaProduct; userId: string; issuedAt: Date | null }> {
  for (const product of products) {
    if (!metaConfigured(product)) continue;
    const signed = readSignedRequest(raw, signingSecrets(product));
    if (!signed) continue;
    // Counted while a secret is rotated, so the operator knows when the previous one can go (D12).
    if (signed.secretIndex > 0) await countPrevious(product);
    return { product, userId: signed.userId, issuedAt: signed.issuedAt };
  }
  throw new SignedRequestRefused();
}

export interface DeletionStatus {
  done: boolean;
  /** When it was, or will be, done. */
  doneBy: Date;
}

export const metaCallbacksService = {
  /** Instagram's deauthorize: the shop's Instagram card turns to Needs reconnecting (R6, A3). */
  async deauthorize(raw: string, now = new Date()): Promise<void> {
    const { userId, issuedAt } = await verify(raw, [SOCIAL_PLATFORM.INSTAGRAM]);
    const routes = (await connectionPassesRepository.socialRoutes(SOCIAL_PLATFORM.INSTAGRAM, [userId])).filter((r) => r.externalAccountId === userId);
    let changed = 0;
    // Meta's own time when it gives one, so a notice replayed after a reconnect changes nothing.
    for (const route of routes) changed += await channelConnectionRepository.markRemoved(route.id, CONNECTION_ERROR.REMOVED_IN_APP, issuedAt ?? now);
    console.info(JSON.stringify({ scope: "meta.callback", step: "deauthorize", matched: routes.length, changed }));
  },

  /** A deletion request: stored, its job queued in the same commit, Meta answered with our code (R7, A4). */
  async requestDeletion(raw: string): Promise<{ url: string; confirmation_code: string }> {
    const { product, userId } = await verify(raw, [SOCIAL_PLATFORM.INSTAGRAM, SOCIAL_PLATFORM.WHATSAPP]);
    const code = newCode();
    await prisma.$transaction(async (tx) => {
      const row = await dataDeletionRepository.create(tx, { code, product, userIdHash: userIdHash(product, userId), sealedUserId: encryptSecret(userId) });
      await enqueue(tx, deletePersonSpec, { requestId: row.id });
    });
    console.info(JSON.stringify({ scope: "meta.callback", step: "data-deletion", product }));
    return { url: `${appUrl()}${ROUTES.dataDeletion(code)}`, confirmation_code: code };
  },

  /** The job: every domain that holds this person forgets them, then the request is done. */
  async runDeletion(requestId: string, now = new Date()): Promise<void> {
    const request = await dataDeletionRepository.byId(requestId);
    if (!request || request.state === DELETION_STATE.DONE) return;
    const userId = decryptSecret(request.sealedUserId);
    const platform = PRODUCT.parse(request.product);
    // A forgetter that fails throws, so the queue retries the whole request; each is idempotent.
    for (const forgetter of allForgetters()) await forgetter.forget(platform, userId);
    await dataDeletionRepository.markDone(request.id, now);
    console.info(JSON.stringify({ scope: "meta.callback", step: "deleted", requestId, forgetters: allForgetters().length }));
  },

  /**
   * The public status page: state and dates only, never who (R7). Done means every domain forgot the
   * person and the raw events they may appear in have aged out (Q7), not only that the job ran.
   */
  async status(code: string, now = new Date()): Promise<DeletionStatus | null> {
    if (!/^[A-Z0-9]{12}$/.test(code)) return null;
    const row = await dataDeletionRepository.byCode(code);
    if (!row) return null;
    const doneBy = new Date(row.requestedAt.getTime() + DELETION_DAYS * 86_400_000);
    return { done: row.state === DELETION_STATE.DONE && now >= doneBy, doneBy };
  },
};
