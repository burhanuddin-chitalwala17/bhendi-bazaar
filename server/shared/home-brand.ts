/**
 * The platform's own shop, whose marketplace connections read the published type definitions every
 * shop shares (setup-requests Q14; listing-model/channel-catalogue D2). Read here only; unset, the
 * requests previews and the catalogue refresh both say so.
 */
export function homeBrandOrgId(): string | null {
  const id = process.env.HOME_BRAND_ORG_ID?.trim();
  return id ? id : null;
}
