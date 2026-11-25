import { CONNECTION_STATE, TYPES_UNAVAILABLE, isMarketplaceChannel, type MarketplaceChannel, type TypesUnavailable } from "./channel-connection.types";

export { TYPES_UNAVAILABLE, type TypesUnavailable };
import { channelConnectionRepository } from "./channel-connection.repository";
import { connectionPassesRepository } from "./channel-connection-passes.repository";
import { channelConnectionService } from "./channel-connection.service";
import { MarketplaceAuthError } from "./providers/marketplace-provider";
import type { TypeDefinition, TypeMatch } from "./providers/publish";
import { providerFor } from "./providers";
import { channelPlan } from "./channel-plan";

export type { TypeAttribute, TypeDefinition, TypeMatch } from "./providers/publish";

/** Why a marketplace's types could not be read for the platform (setup-requests Q14). */
export class TypesUnavailableError extends Error {
  constructor(readonly reason: TypesUnavailable) {
    super(`Marketplace types unavailable: ${reason}`);
    this.name = "TypesUnavailableError";
  }
}

/** One org's connected account as a token source; refused when it is not connected. The token never leaves. */
async function sourceFor(orgId: string, channel: MarketplaceChannel) {
  const row = await channelConnectionRepository.find(orgId, channel);
  if (!row || row.state !== CONNECTION_STATE.CONNECTED) throw new TypesUnavailableError(TYPES_UNAVAILABLE.NOT_CONNECTED);
  return () => channelConnectionService.accessToken(row.id);
}

async function guarded<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof TypesUnavailableError) throw error;
    if (error instanceof MarketplaceAuthError) throw new TypesUnavailableError(TYPES_UNAVAILABLE.NOT_CONNECTED);
    throw new TypesUnavailableError(TYPES_UNAVAILABLE.UNREACHABLE);
  }
}

/**
 * A marketplace's published type definitions and type search, read through one org's connection
 * (setup-requests D7, D10): the platform's home brand. What a type requires is the same for every
 * shop, so nothing of that org's account is read beyond the public definitions.
 */
export const channelTypesService = {
  async definition(orgId: string, channel: string, theirCategory: string): Promise<TypeDefinition | null> {
    if (!isMarketplaceChannel(channel)) return null;
    return await guarded(async () => providerFor(channel).typeDefinition(await sourceFor(orgId, channel), theirCategory));
  },

  /** Which shops sell on which marketplace now, for a pass over every shop (setup-requests D5). */
  /** Connected shops that hold Channels: a shop without it raises no marketplace request (feature-access Q19, D5). */
  async connectedOrgs(): Promise<Array<{ orgId: string; channel: MarketplaceChannel }>> {
    const rows = (await connectionPassesRepository.connectedOrgs()).flatMap((r) => (isMarketplaceChannel(r.channel) ? [{ orgId: r.orgId, channel: r.channel }] : []));
    const holding = await channelPlan.allowed([...new Set(rows.map((r) => r.orgId))]);
    return rows.filter((r) => holding.has(r.orgId));
  },

  async search(orgId: string, channel: string, words: string): Promise<TypeMatch[]> {
    if (!isMarketplaceChannel(channel)) return [];
    return await guarded(async () => providerFor(channel).searchTypes(await sourceFor(orgId, channel), words));
  },
};
