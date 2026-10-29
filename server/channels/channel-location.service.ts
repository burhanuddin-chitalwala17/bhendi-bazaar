import { CHANNEL_LABELS } from "@server/shared/channels";
import { prisma } from "@server/shared/prisma";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
import { orgAddressService } from "@server/catalog/org.address.service";

import { isMarketplaceChannel, type MarketplaceChannel } from "./channel-connection.types";
import { channelConnectionRepository } from "./channel-connection.repository";
import { channelConnectionService } from "./channel-connection.service";
import { channelLocationRepository } from "./channel-location.repository";
import { STOCK_SYNC, type ChannelLocationDTO, type LocationMatchDTO } from "./channel-stock.types";
import { channelStockService } from "./channel-stock.service";
import { providerFor } from "./providers";

/**
 * A connected account's pickup locations and the shop's location each stands for (inventory-sync D1,
 * Q15, Q16): read on connecting and on Read again, matched once by the owner.
 */
export const channelLocationService = {
  /** Read the marketplace's locations and record them; a refusal leaves what was recorded. */
  async refresh(connectionId: string, now = new Date()): Promise<void> {
    const connection = await channelConnectionRepository.forRead(connectionId);
    if (!connection || !isMarketplaceChannel(connection.channel)) return;
    const seen = await providerFor(connection.channel).readLocations(() => channelConnectionService.accessToken(connectionId), connection.externalAccountId);
    await channelLocationRepository.recordSeen({ id: connection.id, orgId: connection.orgId }, seen, now);
  },

  /** The Match locations sheet: each location with its match, or a suggestion by pincode. */
  async matches(orgId: string, channel: string): Promise<LocationMatchDTO> {
    if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
    const connection = await channelConnectionRepository.find(orgId, channel);
    if (!connection) throw new NotFoundError("Connection");
    const [rows, shop] = await Promise.all([channelLocationRepository.forConnection(connection.id), orgAddressService.listLocations(orgId)]);
    const active = shop.filter((l) => l.isActive);
    const locations: ChannelLocationDTO[] = rows.map((r) => {
      const matched = shop.find((l) => l.id === r.orgAddressId);
      const byPincode = r.pincode ? active.filter((l) => l.pincode === r.pincode) : [];
      // One shop location and nothing better: it is the obvious answer (Amazon's single address).
      const suggestedId = r.orgAddressId ?? byPincode[0]?.id ?? (active.length === 1 ? active[0].id : null);
      return {
        id: r.id,
        name: r.name,
        pincode: r.pincode,
        orgAddressId: r.orgAddressId,
        notUsed: r.notUsed,
        suggestedId,
        gone: r.goneAt !== null,
        closed: matched !== undefined && !matched.isActive,
      };
    });
    return {
      channel,
      label: CHANNEL_LABELS[channel as MarketplaceChannel],
      locations,
      shopLocations: shop.map((l) => ({ id: l.id, name: l.name, pincode: l.pincode, isActive: l.isActive })),
      complete: locations.filter((l) => !l.gone).every((l) => (l.orgAddressId !== null && !l.closed) || l.notUsed),
    };
  },

  /** Save the owner's matches; a match names one of this shop's active locations (Q15). */
  async save(orgId: string, channel: string, input: ReadonlyArray<{ id: string; orgAddressId: string | null; notUsed: boolean }>): Promise<void> {
    if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
    const connection = await channelConnectionRepository.find(orgId, channel);
    if (!connection) throw new NotFoundError("Connection");
    const own = new Set((await orgAddressService.listLocations(orgId)).filter((l) => l.isActive).map((l) => l.id));
    if (input.some((m) => !m.notUsed && m.orgAddressId !== null && !own.has(m.orgAddressId))) {
      throw new DomainError("Pick one of your open pickup locations.", { status: 400, field: "matches" });
    }
    await channelLocationRepository.saveMatches(orgId, connection.id, input, new Date());
    // Nothing was sent while a location waited for its match: send everything now (Q16).
    if (connection.stockSync === STOCK_SYNC.ON) await prisma.$transaction((tx) => channelStockService.pushAllIn(tx, connection.id));
  },
};
