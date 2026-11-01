import { Suspense, type ReactNode } from "react";

import type { PaletteKey, ThemeKey } from "@server/catalog/storefront-themes";
import { THEME_FONT_CLASSES } from "../../theme-fonts";
import { ThemedFooter } from "./themed-footer";
import { ThemedHeader } from "./themed-header";
import { ThemedTabBar } from "./themed-tab-bar";
import { ProductChromeGuard } from "./product-chrome-guard";

export interface ThemedShop {
  handle: string;
  name: string;
  logoUrl: string | null;
  themeKey: ThemeKey;
  paletteKey: PaletteKey;
}

/**
 * A themed shop's chrome around its pages (D6, D7; R5): the theme and palette scopes, the theme's
 * faces, and the shop's header, footer and tab bar in place of the marketplace's. The scopes sit
 * on the outermost element so the chrome takes the palette too (Q5: never the device's).
 */
export function ThemedShell({
  shop,
  aroundProduct = false,
  children,
}: {
  shop: ThemedShop;
  /** Drawn by the marketplace layout around one of the shop's products (Q33), not a shop route. */
  aroundProduct?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-theme={shop.themeKey}
      data-palette={shop.paletteKey}
      className={`${THEME_FONT_CLASSES[shop.themeKey]} flex min-h-screen flex-col bg-background text-foreground`}
    >
      <ThemedHeader handle={shop.handle} name={shop.name} logoUrl={shop.logoUrl} />
      <main className="flex-1">{children}</main>
      <ThemedFooter handle={shop.handle} name={shop.name} />
      <ThemedTabBar handle={shop.handle} />
      {aroundProduct && (
        <Suspense fallback={null}>
          <ProductChromeGuard handle={shop.handle} />
        </Suspense>
      )}
    </div>
  );
}

/** The shop as the shell needs it, or null when it has published no look. */
export function themedShop(shop: {
  handle: string;
  name: string;
  logoUrl: string | null;
  themeKey: ThemeKey | null;
  paletteKey: PaletteKey | null;
}): ThemedShop | null {
  const { handle, name, logoUrl, themeKey, paletteKey } = shop;
  return themeKey && paletteKey ? { handle, name, logoUrl, themeKey, paletteKey } : null;
}
