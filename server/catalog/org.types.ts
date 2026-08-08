/**
 * What a product — and every cart line, checkout group and admin form that carries
 * one — knows about its selling organisation. Declared exactly once: this block used
 * to be spelled out in ten places (CONTRACTS.md, consumer-inventory.md §1), which is
 * how stock-locations would have missed one. The default* fields die with that
 * feature's destructive migration; when they do, this is the only place to edit.
 */
export interface OrgSummary {
  id: string;
  name: string;
  code: string;
  defaultPincode: string;
  defaultCity: string;
  defaultState: string;
  defaultAddress: string;
}
