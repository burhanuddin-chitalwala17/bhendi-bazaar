import { channelCatalogueRepository, type CatalogueTypeRow } from "./channel-catalogue.repository";
import type { CatalogueType } from "./channel-catalogue.types";
import { channelMapRepository } from "./channel-map.repository";
import { CHANNEL_LABELS, isChannel, type Channel } from "@server/shared/channels";

/** How long a channel's new requirement stays on Home. */
const CHANGE_WINDOW_DAYS = 14;

/** Home's line: a channel asks more of a type this shop sells (parent Q22). */
export interface CatalogueAttentionDTO {
  channel: Channel;
  label: string;
  typeLabel: string;
  added: number;
}

export type { CatalogueFieldRow, CatalogueTypeRow } from "./channel-catalogue.repository";

/**
 * Each channel's own types and fields (listing-model/channel-catalogue). Listing owns them beside the
 * maps that read them; a channel's reader (channels' providers) supplies a type, and readiness reads
 * the stored fields. Nothing here calls a marketplace.
 */
export const channelCatalogueService = {
  /** Every channel type a BB type publishes to on a channel: what a refresh keeps fresh (D2). */
  async publishedTypes(channel: Channel): Promise<string[]> {
    return await channelMapRepository.publishedTypes(channel);
  },

  /** Store one type as its channel just described it; answers the required fields that are new (Q22). */
  async store(channel: Channel, type: CatalogueType, source: string, now = new Date()): Promise<string[]> {
    return await channelCatalogueRepository.upsertType(channel, type, source, now);
  },

  /** The live fields of some channel types, in one read (D5). */
  async fieldsFor(pairs: ReadonlyArray<{ channel: string; key: string }>): Promise<Map<string, CatalogueTypeRow>> {
    return await channelCatalogueRepository.fieldsFor(pairs);
  },

  async changesSince(since: Date) {
    return await channelCatalogueRepository.changesSince(since);
  },

  /**
   * Home's line (parent Q22): the newest required field a channel added, in the last fortnight, to a
   * channel type this shop's products publish to. Two reads: the changes, and the shop's types.
   */
  async attention(orgId: string, now = new Date()): Promise<CatalogueAttentionDTO | null> {
    const changes = await channelCatalogueRepository.changesSince(new Date(now.getTime() - CHANGE_WINDOW_DAYS * 86_400_000));
    if (changes.length === 0) return null;
    const mine = new Set((await channelMapRepository.publishingTypesFor(orgId)).map((r) => `${r.channel}:${r.theirCategory}`));
    const hit = changes.find((c) => mine.has(`${c.channel}:${c.typeKey}`));
    if (!hit || !isChannel(hit.channel)) return null;
    const added = Array.isArray(hit.added) ? hit.added.length : 0;
    return { channel: hit.channel, label: CHANNEL_LABELS[hit.channel], typeLabel: hit.typeLabel, added };
  },
};
