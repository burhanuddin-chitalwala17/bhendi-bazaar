import { CONNECTION_STATE } from "./channel-connection.types";
import { SOCIAL_PLATFORM } from "./social/types";
import { socialOwnersRepository } from "./social-owners.repository";

/** Who a fact's connection belongs to: its shop, and the platform ids that are the shop itself. */
export interface SocialOwner {
  orgId: string;
  /** The account's own ids (Instagram account, WhatsApp number and business), so a sink can tell the shop's own comment from a person's. */
  selfIds: string[];
  /** The account people write to (the Instagram account, the WhatsApp number): what a thread is with (inbox-core Q20). */
  accountId: string | null;
}

/** A social connection that has stood as it is long enough for retention to act (inbox-core D10). */
export interface SettledConnection {
  connectionId: string;
  disconnected: boolean;
  /** The account it is connected to now; null when disconnected, or when the account is not known. */
  liveAccountId: string | null;
}

type OwnerRow = { channel: string; externalAccountId: string | null; externalPhoneId: string | null };

// One kind of id per platform: a fallback could change kind later and make a live account's threads look past.
const accountOf = (row: OwnerRow) => (row.channel === SOCIAL_PLATFORM.WHATSAPP ? row.externalPhoneId : row.externalAccountId);

/**
 * The shop behind each social connection, for the domains whose sinks receive facts (inbox-core D2):
 * a fact names its connection, never its shop. No token is read.
 */
export const socialOwners = {
  async of(connectionIds: readonly string[]): Promise<Map<string, SocialOwner>> {
    const rows = await socialOwnersRepository.of([...new Set(connectionIds)]);
    return new Map(
      rows.map((row) => [
        row.id,
        {
          orgId: row.orgId,
          selfIds: [row.externalAccountId, row.externalPhoneId, row.externalBusinessId].filter((id): id is string => Boolean(id)),
          accountId: accountOf(row),
        },
      ]),
    );
  },

  /** Connections disconnected, or on their present account, since at least `before`. */
  async settledBefore(before: Date): Promise<SettledConnection[]> {
    const rows = await socialOwnersRepository.settledBefore(before);
    return rows.map((row) => {
      const disconnected = row.state === CONNECTION_STATE.DISCONNECTED;
      return { connectionId: row.id, disconnected, liveAccountId: disconnected ? null : accountOf(row) };
    });
  },
};
