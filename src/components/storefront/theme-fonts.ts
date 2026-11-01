import { Cormorant_Garamond, DM_Mono, Geist_Mono, Jost, Mulish, Space_Grotesk } from "next/font/google";

import { THEME, type ThemeKey } from "@server/catalog/storefront-themes";

// `preload: false` on every face: a layout otherwise preloads each of its fonts on every child
// route, so all six would ride every themed page (storefront-themes D5, Q30). Self-hosted by the
// loader, so CSP's `font-src 'self'` is unchanged. Options are written out in each call: the
// loader reads them at build time and refuses a named constant.

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["system-ui", "Arial", "sans-serif"],
  variable: "--font-space-grotesk",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "Menlo", "monospace"],
  variable: "--font-geist-mono",
});

const jost = Jost({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["system-ui", "Arial", "sans-serif"],
  variable: "--font-jost",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  fallback: ["Georgia", "Times New Roman", "serif"],
  variable: "--font-cormorant-garamond",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "Menlo", "monospace"],
  variable: "--font-dm-mono",
});

const mulish = Mulish({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["system-ui", "Arial", "sans-serif"],
  variable: "--font-mulish",
});

/**
 * The classes that define a theme's face variables. They go on the `[data-theme]` element (or
 * above it), because the scope's `--font-*-face: var(--font-…)` resolves where it is declared.
 */
export const THEME_FONT_CLASSES: Record<ThemeKey, string> = {
  [THEME.EDGE]: `${spaceGrotesk.variable} ${geistMono.variable}`,
  [THEME.DARBAR]: `${jost.variable} ${cormorantGaramond.variable}`,
  [THEME.BLOOM]: dmMono.variable,
  [THEME.DAILY]: mulish.variable,
};
