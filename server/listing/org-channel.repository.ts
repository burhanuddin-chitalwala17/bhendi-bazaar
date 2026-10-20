import { prisma } from "@server/shared/prisma";
import type { Channel } from "@server/shared/channels";

/**
 * The one way to reach `OrgChannel`
 * ([ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md)) — where a shop has said it
 * sells ([channel-registry](../../docs/specs/channel-registry/) D2).
 *
 * Separate from the mapping tables because it is a different kind of thing: the maps are the
 * platform's dictionary, shared by every shop, and this is one shop's choice. They are written
 * by different people for different reasons.
 *
 * An absent row is off. Nothing here writes a default row on an org's behalf, because a shop
 * that has decided nothing should be asked nothing.
 */

export interface OrgChannelRow {
  channel: string;
  enabled: boolean;
}

const SELECT = { channel: true, enabled: true } as const;

/** Enough of a client to write the row: `prisma` or a caller's `$transaction` client. */
export type OrgChannelDb = Pick<typeof prisma, "orgChannel">;

export const orgChannelRepository = {
  async forOrg(orgId: string): Promise<OrgChannelRow[]> {
    return await prisma.orgChannel.findMany({ where: { orgId }, select: SELECT });
  },

  /** Every shop that has turned this channel on. */
  async orgsWith(channel: Channel): Promise<string[]> {
    const rows = await prisma.orgChannel.findMany({
      where: { channel, enabled: true },
      select: { orgId: true },
    });
    return rows.map((row) => row.orgId);
  },

  /** Turn a channel on or off for a shop. The row is created the first time either is said. */
  async set(orgId: string, channel: Channel, enabled: boolean, db: OrgChannelDb = prisma): Promise<OrgChannelRow> {
    return await db.orgChannel.upsert({
      where: { orgId_channel: { orgId, channel } },
      create: { orgId, channel, enabled },
      update: { enabled },
      select: SELECT,
    });
  },

  /**
   * Several at once, in one transaction.
   *
   * A half-saved set would leave a shop selling somewhere it has just said it does not, and the
   * form sends its whole set, so the write is all of it or none.
   */
  async setMany(
    orgId: string,
    choices: readonly { channel: Channel; enabled: boolean }[],
  ): Promise<void> {
    if (choices.length === 0) return;
    await prisma.$transaction(
      choices.map((choice) =>
        prisma.orgChannel.upsert({
          where: { orgId_channel: { orgId, channel: choice.channel } },
          create: { orgId, channel: choice.channel, enabled: choice.enabled },
          update: { enabled: choice.enabled },
          select: { channel: true },
        }),
      ),
    );
  },
};
