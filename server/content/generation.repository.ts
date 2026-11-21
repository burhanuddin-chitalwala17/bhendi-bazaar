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
  costMicroUsd: number;
  costPaise: number;
  error: string | null;
}

const SELECT = {
  id: true,
  idempotencyKey: true,
  modelId: true,
  state: true,
  outputKeys: true,
  costMicroUsd: true,
  costPaise: true,
  error: true,
} satisfies Prisma.GenerationSelect;

export interface OpenGenerationInput {
  idempotencyKey: string;
  purpose: string;
  promptVersion: string;
  platformPrompt: string;
  brief: string | null;
  referenceAssetIds: string[];
  aspect: string;
  size: string;
  containsPerson: boolean;
  enhancementId: string | null;
}

export interface SucceedInput {
  modelId: string;
  outputKeys: string[];
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

  async succeed(id: string, input: SucceedInput): Promise<boolean> {
    const { count } = await prisma.generation.updateMany({
      where: { id, state: GenerationState.SUBMITTED },
      data: { ...input, state: GenerationState.SUCCEEDED, finishedAt: new Date() },
    });
    return count === 1;
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

  /** What one enhancement's generations cost, for the run's own row. */
  async costForEnhancement(enhancementId: string): Promise<number> {
    const { _sum } = await prisma.generation.aggregate({
      where: { enhancementId, state: GenerationState.SUCCEEDED },
      _sum: { costPaise: true },
    });
    return _sum.costPaise ?? 0;
  }
}

export const generationRepository = new GenerationRepository();
