/**
 * What a product — and every cart line, checkout group and admin form that carries
 * one — knows about its selling organisation. Declared exactly once (PR-45 collapsed
 * ten copies), which is why the stock-locations destructive PR could remove the four
 * default* origin fields here and nowhere else: origin now lives on OrgAddress rows.
 */
export interface OrgSummary {
  id: string;
  name: string;
  code: string;
  /**
   * The shop's public address. Carried on every product so a card, a cart line or a
   * product page can link to `/store/<handle>` without asking again — the storefront is
   * reachable from anything the org sells (org-storefront R5).
   */
  handle: string;
}

/**
 * What creating an organisation takes.
 *
 * Declared here rather than in `src/domain/org.ts`, which is where it used to live and
 * where `server/` had to reach out to read it — the one direction CLAUDE.md forbids.
 * `src/domain/org.ts` re-exports it, so the client keeps its import path.
 */
export interface CreateOrgInput {
  code: string;
  /// Server-generated from the name, never accepted from a request body. Changing one
  /// later is its own authorised operation, not a field on an update.
  handle: string;
  name: string;
  email: string;
  phone?: string;
  contactPerson?: string;
  businessName?: string;
  gstNumber?: string;
  panNumber?: string;
  isActive: boolean;
  description?: string;
}

export interface UpdateOrgInput extends Partial<CreateOrgInput> {
  id: string;
}
