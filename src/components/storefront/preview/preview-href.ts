import type { PaletteKey, ThemeKey } from "@server/catalog/storefront-themes";

/** The two views the preview's switch offers (ux.md journey 1), compared by constant. */
export const PREVIEW_VIEW = { LANDING: "landing", SHOP: "shop" } as const;
export type PreviewView = (typeof PREVIEW_VIEW)[keyof typeof PREVIEW_VIEW];

/** The preview page a picker frame embeds (D12); the path `SELF_FRAMED_SOURCE` lets us frame. */
export function lookPreviewHref(
  orgId: string,
  theme: ThemeKey,
  palette: PaletteKey,
  view: PreviewView = PREVIEW_VIEW.LANDING,
  revision = 0,
) {
  const query = new URLSearchParams({ theme, palette, view });
  // A saved section is a new page: the revision makes the frame load it again (D13).
  if (revision) query.set("r", String(revision));
  return `/org/${orgId}/storefront/preview?${query.toString()}`;
}
