import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { POST_STATE } from "./post.types";

/** The one way to reach `Post` (ADR-0003). Every read and write is scoped by the shop. */

type PostDb = Pick<typeof prisma, "post">;

export interface PostContent {
  caption: string;
  mediaIds: string[];
  productIds: string[];
}

const ROW = {
  id: true,
  version: true,
  state: true,
  caption: true,
  mediaIds: true,
  productIds: true,
  scheduledAt: true,
  updatedAt: true,
  destinations: { select: { kind: true, fields: true }, orderBy: { createdAt: "asc" } },
} as const satisfies Prisma.PostSelect;

export type PostRow = Prisma.PostGetPayload<{ select: typeof ROW }>;

export const postRepository = {
  async find(orgId: string, id: string, db: PostDb = prisma): Promise<PostRow | null> {
    return await db.post.findFirst({ where: { id, orgId }, select: ROW });
  },

  async createDraft(orgId: string, createdById: string, content: PostContent, db: PostDb = prisma): Promise<{ id: string }> {
    return await db.post.create({
      data: { orgId, createdById, state: POST_STATE.DRAFT, ...content },
      select: { id: true },
    });
  },

  /**
   * Autosave as a compare-and-set on the version the composer saw (D3): of two saves from one version
   * exactly one lands. False is a stale version, a post no longer a draft, or none; the caller re-reads.
   */
  async saveDraftIfVersion(orgId: string, id: string, version: number, content: PostContent, db: PostDb = prisma): Promise<boolean> {
    const { count } = await db.post.updateMany({
      where: { id, orgId, version, state: POST_STATE.DRAFT },
      data: { ...content, version: { increment: 1 } },
    });
    return count === 1;
  },
};
