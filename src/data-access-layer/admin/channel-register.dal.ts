// DATA ACCESS LAYER FOR THE CHANNEL REGISTER

import { cache } from "react";

import {
  channelRegisterService,
  type ChannelRegisterView,
} from "@server/listing/channel-register.service";
import type { Channel } from "@server/shared/channels";

/**
 * What the channel register reads, on the server
 * ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 *
 * `cache` is React's per-request memo: the summary builds every channel's view, and a page that
 * then opens one of them reads it once rather than twice.
 */
class ChannelRegisterDAL {
  getView = cache(async (channel: Channel): Promise<ChannelRegisterView> => {
    return channelRegisterService.view(channel);
  });

  getSummary = cache(async () => channelRegisterService.summary());
}

export const adminChannelRegisterDAL = new ChannelRegisterDAL();
