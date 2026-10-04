// DATA ACCESS LAYER FOR A PRODUCT'S CHANNEL READINESS

import { cache } from "react";

import {
  channelReadinessService,
  type ChannelVerdict,
  type ReadinessSubject,
} from "@server/catalog/channel-readiness.service";

/**
 * What each channel would make of a product, on the server
 * ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 *
 * A read, not a mutation, so a server component does it and no route handler exists for it — a
 * client fetch here would be a round trip bought for nothing.
 */
class ChannelReadinessDAL {
  forProduct = cache(
    async (orgId: string, subject: ReadinessSubject): Promise<ChannelVerdict[]> =>
      channelReadinessService.forProduct(orgId, subject),
  );
}

export const orgChannelReadinessDAL = new ChannelReadinessDAL();
