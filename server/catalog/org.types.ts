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
}
