import { ACCOUNT_EVENT, FACT_KIND } from "@server/shared/social-events/facts";
import { registerSink } from "@server/shared/social-events/sinks";
import { channelConnectionRepository } from "./channel-connection.repository";
import { CONNECTION_ERROR } from "./channel-connection.types";

/**
 * Channels' own sinks, registered when the worker imports this file (ADR-0078 decision 4):
 * WhatsApp telling us the shop removed our app, or set its Business app up on another phone,
 * turns the card to Needs reconnecting (meta-foundation D6). The daily check stays the backstop.
 */

const ENDING = {
  [ACCOUNT_EVENT.REMOVED]: CONNECTION_ERROR.REMOVED_IN_APP,
  [ACCOUNT_EVENT.OFFBOARDED]: CONNECTION_ERROR.OFFBOARDED,
} as const;

registerSink({
  name: "channels.connection-health",
  kind: FACT_KIND.ACCOUNT_UPDATE,
  order: 0,
  async handle(facts) {
    for (const fact of facts) {
      const reason = ENDING[fact.event as keyof typeof ENDING];
      // Conditional on a live row older than the notice: a repeat, or a notice older than a reconnect, writes nothing.
      if (reason) await channelConnectionRepository.markRemoved(fact.connectionId, reason, fact.occurredAt);
    }
  },
});
