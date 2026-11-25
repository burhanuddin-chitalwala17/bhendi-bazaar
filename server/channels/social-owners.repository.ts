import { prisma } from "@server/shared/prisma";
import { CONNECTION_STATE } from "./channel-connection.types";
import { SOCIAL_PLATFORM } from "./social/types";

/** A read of `ChannelConnection` for the sinks: which shop holds each social connection. Writes stay in `channel-connection.repository`. */

const OWNER = { id: true, orgId: true, channel: true, externalAccountId: true, externalPhoneId: true, externalBusinessId: true } as const;

export const socialOwnersRepository = {
  async of(ids: readonly string[]) {
    if (ids.length === 0) return [];
    return await prisma.channelConnection.findMany({ where: { id: { in: [...ids] } }, select: OWNER });
  },

  /** Social connections disconnected on or before `before`, or connected (to whichever account) on or before it. */
  async settledBefore(before: Date) {
    return await prisma.channelConnection.findMany({
      where: {
        channel: { in: Object.values(SOCIAL_PLATFORM) },
        OR: [
          { state: CONNECTION_STATE.DISCONNECTED, disconnectedAt: { lte: before } },
          { state: { not: CONNECTION_STATE.DISCONNECTED }, connectedAt: { lte: before } },
        ],
      },
      select: { ...OWNER, state: true },
      orderBy: { id: "asc" },
    });
  },
};
