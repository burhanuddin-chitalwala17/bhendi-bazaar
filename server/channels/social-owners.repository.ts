import { prisma } from "@server/shared/prisma";

/** A read of `ChannelConnection` for the sinks: which shop holds each social connection. Writes stay in `channel-connection.repository`. */
export const socialOwnersRepository = {
  async of(ids: readonly string[]) {
    if (ids.length === 0) return [];
    return await prisma.channelConnection.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, orgId: true, externalAccountId: true, externalPhoneId: true, externalBusinessId: true },
    });
  },
};
