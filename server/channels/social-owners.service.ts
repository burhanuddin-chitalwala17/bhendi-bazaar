import { socialOwnersRepository } from "./social-owners.repository";

/** Who a fact's connection belongs to: its shop, and the platform ids that are the shop itself. */
export interface SocialOwner {
  orgId: string;
  /** The account's own ids (Instagram account, WhatsApp number and business), so a sink can tell the shop's own comment from a person's. */
  selfIds: string[];
}

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
        { orgId: row.orgId, selfIds: [row.externalAccountId, row.externalPhoneId, row.externalBusinessId].filter((id): id is string => Boolean(id)) },
      ]),
    );
  },
};
