import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { POST_DESTINATION_STATE, type PostDestinationKind } from "./post.types";

/** The one way to reach `PostDestination` (ADR-0003). */

type DestinationDb = Pick<typeof prisma, "postDestination">;

export const postDestinationRepository = {
  /**
   * A draft's picked destinations become exactly `kinds`: an unpicked one goes, a new one is added,
   * a kept one keeps its fields. Only draft rows move; a scheduled destination is never touched here.
   */
  async setDraftKinds(postId: string, kinds: readonly PostDestinationKind[], db: DestinationDb = prisma): Promise<void> {
    await db.postDestination.deleteMany({
      where: { postId, state: POST_DESTINATION_STATE.DRAFT, kind: { notIn: [...kinds] } },
    });
    await db.postDestination.createMany({
      data: kinds.map((kind) => ({ postId, kind, state: POST_DESTINATION_STATE.DRAFT })),
      skipDuplicates: true,
    });
  },

  /** Duplicate (Q7): the new draft's destinations, each with the plug fields it was given. */
  async copyAsDraft(postId: string, from: ReadonlyArray<{ kind: PostDestinationKind; fields: Prisma.JsonValue }>, db: DestinationDb = prisma): Promise<void> {
    if (from.length === 0) return;
    await db.postDestination.createMany({
      data: from.map((d) => ({ postId, kind: d.kind, state: POST_DESTINATION_STATE.DRAFT, fields: d.fields ?? {} })),
    });
  },
};
