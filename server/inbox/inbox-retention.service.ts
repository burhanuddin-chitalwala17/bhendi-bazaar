import { socialOwners } from "@server/channels/social-owners.service";
import { conversationCare } from "./conversation.repository";

/**
 * What the inbox keeps, and for how long (inbox-core D10, R13, parent Q34): a thread lives while its
 * account is connected and is deleted 90 days after the shop leaves that account; a person's
 * deletion request removes their threads at once. Deleted in batches, off the request path (A-D15).
 */

const KEEP_MS = 90 * 24 * 60 * 60 * 1000;
const BATCH = 1_000;
/** A run's ceiling in full batches; whatever is left goes tomorrow. */
const MAX_BATCHES = 100;

export const inboxRetention = {
  async run(now = new Date()): Promise<{ deleted: number }> {
    const settled = await socialOwners.settledBefore(new Date(now.getTime() - KEEP_MS));
    let deleted = 0;
    let batches = 0;
    for (const connection of settled) {
      while (batches < MAX_BATCHES) {
        const ids = await conversationCare.retired(connection.connectionId, connection.liveAccountId, connection.disconnected, BATCH);
        deleted += await conversationCare.remove(ids);
        // Only a full batch counts: a settled connection with nothing left costs one empty read, never the ceiling.
        if (ids.length < BATCH) break;
        batches++;
      }
    }
    return { deleted };
  },

  /** A person Meta asked us to forget (meta-foundation D7): every thread they started, in every shop. Idempotent. */
  async forgetPerson(platform: string, personKey: string): Promise<void> {
    for (;;) {
      const ids = await conversationCare.ofPerson(platform, personKey, BATCH);
      await conversationCare.remove(ids);
      if (ids.length < BATCH) return;
    }
  },
};
