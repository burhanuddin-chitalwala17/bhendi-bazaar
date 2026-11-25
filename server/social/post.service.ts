import { mediaAssetService } from "@server/catalog/media-asset.service";
import { productService } from "@server/catalog/product.service";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import type { PostDraftInput, PostDraftSaveInput } from "@/lib/validation/schemas/post.schema";
import { postDestinationRepository } from "./post-destination.repository";
import { postRepository, type PostContent, type PostRow } from "./post.repository";
import { POST_COPY, POST_STATE, type PostDestinationKind, type PostDraftDTO, type PostState } from "./post.types";

/** Drafts and autosave (social-selling/post-composer D1, D3; spec R1, R6, R10). */

function toDto(row: PostRow): PostDraftDTO {
  return {
    id: row.id,
    version: row.version,
    state: row.state as PostState,
    caption: row.caption,
    mediaIds: row.mediaIds,
    productIds: row.productIds,
    destinations: row.destinations.map((d) => d.kind as PostDestinationKind),
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A post names only its own shop's library and products, never another's (R1, R6). */
async function assertOwned(orgId: string, content: PostContent): Promise<void> {
  if (!(await mediaAssetService.allReadyInLibrary(orgId, content.mediaIds))) {
    throw new DomainError(POST_COPY.mediaNotInLibrary, { field: "mediaIds" });
  }
  if (content.productIds.length === 0) return;
  const [names, outside] = await Promise.all([
    productService.namesByIds(content.productIds),
    productService.countOutsideOrg(content.productIds, orgId),
  ]);
  if (names.size !== content.productIds.length || outside > 0) {
    throw new DomainError(POST_COPY.productNotYours, { field: "productIds" });
  }
}

const contentOf = (input: PostDraftInput): PostContent => ({
  caption: input.caption,
  mediaIds: input.mediaIds,
  productIds: input.productIds,
});

async function read(orgId: string, id: string): Promise<PostDraftDTO> {
  const row = await postRepository.find(orgId, id);
  if (!row) throw new NotFoundError(POST_COPY.notFound);
  return toDto(row);
}

export const postService = {
  get: read,

  async createDraft(orgId: string, userId: string, input: PostDraftInput): Promise<PostDraftDTO> {
    const content = contentOf(input);
    await assertOwned(orgId, content);
    const { id } = await prisma.$transaction(async (tx) => {
      const created = await postRepository.createDraft(orgId, userId, content, tx);
      await postDestinationRepository.setDraftKinds(created.id, input.destinations, tx);
      return created;
    });
    return await read(orgId, id);
  },

  /**
   * Autosave (D3): writes only at the version the composer saw. A miss is 409 and the composer
   * re-reads the newer draft; the destinations move in the same transaction, so they never disagree.
   */
  async saveDraft(orgId: string, id: string, input: PostDraftSaveInput): Promise<PostDraftDTO> {
    const content = contentOf(input);
    // A read, not a guard: a picture retired after it is a Stale state (ux.md), and schedule checks again (D7).
    await assertOwned(orgId, content);
    const saved = await prisma.$transaction(async (tx) => {
      if (!(await postRepository.saveDraftIfVersion(orgId, id, input.version, content, tx))) return false;
      await postDestinationRepository.setDraftKinds(id, input.destinations, tx);
      return true;
    });
    if (saved) return await read(orgId, id);
    const current = await read(orgId, id);
    throw new ConflictError(current.state === POST_STATE.DRAFT ? POST_COPY.stale : POST_COPY.notEditable);
  },

  /**
   * Duplicate (R10, Q7): a new draft with the same media, caption, products and destinations; never its
   * time. Not re-checked: a picture retired since shows as Stale in the composer (ux.md), to be replaced.
   */
  async duplicate(orgId: string, userId: string, id: string): Promise<PostDraftDTO> {
    const source = await postRepository.find(orgId, id);
    if (!source) throw new NotFoundError(POST_COPY.notFound);
    const content = { caption: source.caption, mediaIds: source.mediaIds, productIds: source.productIds };
    const { id: newId } = await prisma.$transaction(async (tx) => {
      const created = await postRepository.createDraft(orgId, userId, content, tx);
      await postDestinationRepository.copyAsDraft(created.id, source.destinations.map((d) => ({ kind: d.kind as PostDestinationKind, fields: d.fields })), tx);
      return created;
    });
    return await read(orgId, newId);
  },
};
