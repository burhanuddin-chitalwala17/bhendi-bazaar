import { GenerationState, Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";

/**
 * The one reader and writer of `Generation` (ADR-0003; generation-foundation trd D6). A row is
 * written before the model is called, keyed by the caller's idempotency key, and moved once to the
 * state it ends in; a second move from a finished row changes nothing.
 */
export interface GenerationRow {
  id: string;
  idempotencyKey: string;
  modelId: string | null;
  state: GenerationState;
  outputKeys: string[];
  /** A text generation's answer (ADR-0087); null for a picture. */
  outputText: string | null;
  costMicroUsd: number;
  costPaise: number;
  error: string | null;
  createdAt: Date;
}

const SELECT = {
  id: true,
  idempotencyKey: true,
  modelId: true,
  state: true,
  outputKeys: true,
  outputText: true,
  costMicroUsd: true,
  costPaise: true,
  error: true,
  createdAt: true,
} satisfies Prisma.GenerationSelect;

export interface OpenGenerationInput {
  idempotencyKey: string;
  purpose: string;
  promptVersion: string;
  platformPrompt: string;
  brief: string | null;
  referenceAssetIds: string[];
  /** Null for text, which has no shape or size. */
  aspect: string | null;
  size: string | null;
  containsPerson: boolean;
  enhancementId: string | null;
}

export interface PaidInput {
  modelId: string;
  costMicroUsd: number;
  costPaise: number;
  rateDay: Date | null;
}

export class GenerationRepository {
  async findByKey(idempotencyKey: string): Promise<GenerationRow | null> {
    return await prisma.generation.findUnique({ where: { idempotencyKey }, select: SELECT });
  }

  /**
   * The row for this key, made if absent. A row already present is returned as it stands, so the
   * caller can tell a replay from a first call by its state.
   */
  async open(input: OpenGenerationInput): Promise<{ row: GenerationRow; created: boolean }> {
    try {
      const row = await prisma.generation.create({ data: input, select: SELECT });
      return { row, created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const row = await this.findByKey(input.idempotencyKey);
        if (row) return { row, created: false };
      }
      throw error;
    }
  }

  /** A worker died mid-call and this one is calling again: say so on the row (trd D6). */
  async markRetriedAfterUnknown(id: string): Promise<void> {
    await prisma.generation.updateMany({
      where: { id, state: GenerationState.SUBMITTED },
      data: { retriedAfterUnknown: true },
    });
  }

  /**
   * A model answered, or may have (trd D6): the spend is recorded the moment it is known, before
   * anything else can fail. Added, never set, so a call repeated after a crash shows both.
   */
  async recordPaid(id: string, input: PaidInput): Promise<void> {
    await prisma.generation.updateMany({
      where: { id, state: GenerationState.SUBMITTED },
      data: {
        modelId: input.modelId,
        rateDay: input.rateDay,
        costMicroUsd: { increment: input.costMicroUsd },
        costPaise: { increment: input.costPaise },
      },
    });
  }

  async succeed(id: string, outputKeys: string[]): Promise<boolean> {
    const { count } = await prisma.generation.updateMany({
      where: { id, state: GenerationState.SUBMITTED },
      data: { outputKeys, state: GenerationState.SUCCEEDED, finishedAt: new Date() },
    });
    return count === 1;
  }

  /** A text answer is kept on its row: small, and read back on a replay instead of calling again. */
  async succeedText(id: string, text: string): Promise<boolean> {
    const { count } = await prisma.generation.updateMany({
      where: { id, state: GenerationState.SUBMITTED },
      data: { outputText: text, state: GenerationState.SUCCEEDED, finishedAt: new Date() },
    });
    return count === 1;
  }

  /** What the generations under these keys cost, whatever became of them: spend is spend (trd D6). */
  async costForKeys(idempotencyKeys: string[]): Promise<number> {
    if (idempotencyKeys.length === 0) return 0;
    const { _sum } = await prisma.generation.aggregate({
      where: { idempotencyKey: { in: idempotencyKeys } },
      _sum: { costPaise: true },
    });
    return _sum.costPaise ?? 0;
  }

  async fail(id: string, refused: boolean, error: string, modelId: string | null): Promise<boolean> {
    const { count } = await prisma.generation.updateMany({
      where: { id, state: GenerationState.SUBMITTED },
      data: {
        state: refused ? GenerationState.REFUSED : GenerationState.FAILED,
        error: error.slice(0, 500),
        modelId,
        finishedAt: new Date(),
      },
    });
    return count === 1;
  }

  /** Where one enhancement's model outputs were stored, to delete once the run is kept. */
  async outputKeysForEnhancement(enhancementId: string): Promise<string[]> {
    const rows = await prisma.generation.findMany({ where: { enhancementId }, select: { outputKeys: true } });
    return rows.flatMap((row) => row.outputKeys);
  }

  /** What one enhancement's generations cost, whatever became of them: spend is spend (trd D6). */
  async costForEnhancement(enhancementId: string): Promise<number> {
    const { _sum } = await prisma.generation.aggregate({
      where: { enhancementId },
      _sum: { costPaise: true },
    });
    return _sum.costPaise ?? 0;
  }
}

export const generationRepository = new GenerationRepository();
