import {
  CHANNEL_KINDS,
  CHANNEL_LABELS,
  PUBLISHABLE_CHANNELS,
  isChannel,
  type Channel,
  type ChannelKind,
} from "@server/shared/channels";

import { orgChannelRepository, type OrgChannelDb } from "./org-channel.repository";

export type { OrgChannelDb };

/**
 * Where a shop sells, read and written
 * ([channel-registry](../../docs/specs/channel-registry/) D2, spec R9).
 *
 * The storefront is not here: a shop does not opt into the place it already is. What this
 * answers is the publishable set, each with whether the shop has turned it on — and off is what
 * an absent row means, so a shop that has never been asked is not treated as having declined.
 */

export interface OrgChannelChoice {
  channel: Channel;
  label: string;
  kind: ChannelKind;
  enabled: boolean;
}

export const orgChannelService = {
  /** Every channel a shop could sell on, in display order, with its current answer. */
  async list(orgId: string): Promise<OrgChannelChoice[]> {
    const rows = await orgChannelRepository.forOrg(orgId);
    const enabled = new Set(
      rows.filter((row) => row.enabled && isChannel(row.channel)).map((row) => row.channel),
    );

    return PUBLISHABLE_CHANNELS.map((channel) => ({
      channel,
      label: CHANNEL_LABELS[channel],
      kind: CHANNEL_KINDS[channel],
      enabled: enabled.has(channel),
    }));
  },

  /**
   * Replace a shop's answers with the set the form sent.
   *
   * A channel the body does not mention is left alone rather than switched off: the form sends
   * what it showed, and treating silence as "off" would turn off whatever a later release adds
   * the moment an older page posted.
   */
  /**
   * One channel on or off, inside the caller's transaction. Connecting a marketplace is how a shop
   * starts selling there (channel-connectors D11), so the two commit together.
   */
  async setIn(db: OrgChannelDb, orgId: string, channel: Channel, enabled: boolean): Promise<void> {
    await orgChannelRepository.set(orgId, channel, enabled, db);
  },

  async save(orgId: string, choices: readonly { channel: Channel; enabled: boolean }[]) {
    await orgChannelRepository.setMany(
      orgId,
      choices.filter((choice) => isChannel(choice.channel)),
    );
    return await this.list(orgId);
  },
};
