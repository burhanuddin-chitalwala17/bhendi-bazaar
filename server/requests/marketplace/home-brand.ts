/**
 * The platform's own shop, whose marketplace connections read the published type definitions every
 * shop shares (setup-requests Q14, D10). Read here and nowhere else; unset means previews say so.
 */
export function homeBrandOrgId(): string | null {
  const id = process.env.HOME_BRAND_ORG_ID?.trim();
  return id ? id : null;
}
