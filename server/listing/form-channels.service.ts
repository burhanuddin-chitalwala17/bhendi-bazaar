import { CHANNEL, CHANNELS } from "@server/shared/channels";

import { channelCatalogueRepository } from "./channel-catalogue.repository";
import { channelMapRepository } from "./channel-map.repository";
import { fieldMapRepository } from "./field-map.repository";
import { ANY_KIND, channelUseFor, type ChannelUseByKind, type TypeChannel } from "./form-channels";
import type { ProductTypeRecord } from "./product-type.types";

/** A type as the product form reads it: its questions, and which channel needs each (dynamic-form D1). */
export type FormProductType = ProductTypeRecord & { channelUse?: ChannelUseByKind };

/**
 * Every type the form may switch to, each with which of the shop's channels need each question
 * (dynamic-form R2): the channel maps, field maps and catalogue read once for all of them.
 */
export const formChannelsService = {
  async withChannelUse(types: readonly ProductTypeRecord[], enabledChannels: readonly string[]): Promise<FormProductType[]> {
    const typeKeys = types.map((t) => t.key);
    const channels = CHANNELS.filter((c) => c !== CHANNEL.STORE);
    const publishing = (await Promise.all(channels.map(async (channel) => (await channelMapRepository.publishingFor(channel, typeKeys)).map((r) => ({ ...r, channel }))))).flat();
    const pairs = [...new Map(publishing.filter((r) => r.theirCategory).map((r) => [`${r.channel}:${r.theirCategory}`, { channel: r.channel, key: r.theirCategory! }])).values()];
    const [catalogue, maps] = await Promise.all([
      channelCatalogueRepository.fieldsFor(pairs),
      fieldMapRepository.forTypes(pairs.map((p) => ({ channel: p.channel, channelType: p.key }))),
    ]);
    const enabled = new Set(enabledChannels);
    return types.map((type) => {
      // Each kind reads its own channel types, else the type's kind-less ones, as readiness picks (Q7).
      const rowsFor = (kind: string | null) => {
        const own = publishing.filter((r) => r.productType === type.key && r.theirCategory && r.kind === kind);
        return own.length > 0 || kind === null ? own : publishing.filter((r) => r.productType === type.key && r.theirCategory && r.kind === null);
      };
      const useFor = (kind: string | null) => channelUseFor(type.key, rowsFor(kind).map((r): TypeChannel => ({
        channel: r.channel,
        fields: catalogue.get(`${r.channel}:${r.theirCategory}`)?.fields ?? [],
        maps: maps.filter((m) => m.channel === r.channel && m.channelType === r.theirCategory),
      })), enabled);
      const channelUse: ChannelUseByKind = { [ANY_KIND]: useFor(null) };
      for (const k of type.kinds) channelUse[k.key] = useFor(k.key);
      return { ...type, channelUse };
    });
  },
};
