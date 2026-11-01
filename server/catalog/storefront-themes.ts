/**
 * The storefront themes, declared once (ADR-0064; storefront-themes D1, Q2, Q18).
 *
 * A shop stores a theme key and a palette key; everything a key means lives here and in the
 * `[data-theme]` / `[data-palette]` scopes of `src/app/globals.css`.
 */

export const THEME = {
  EDGE: "edge",
  DARBAR: "darbar",
  BLOOM: "bloom",
  DAILY: "daily",
} as const;
export type ThemeKey = (typeof THEME)[keyof typeof THEME];
export const THEME_KEYS = Object.values(THEME) as [ThemeKey, ...ThemeKey[]];

export const PALETTE = {
  CARBON: "carbon",
  GRAPHITE: "graphite",
  SIGNAL: "signal",
  EMERALD: "emerald",
  NAVY: "navy",
  KUMKUM: "kumkum",
  BLUSH: "blush",
  PEACH: "peach",
  LILAC: "lilac",
  FRESH: "fresh",
  BAZAAR: "bazaar",
  COBALT: "cobalt",
} as const;
export type PaletteKey = (typeof PALETTE)[keyof typeof PALETTE];

/** Fixed by design, never the device's (Q5); the scope sets `color-scheme` to match. */
export const PALETTE_TONE = { LIGHT: "light", DARK: "dark" } as const;
export type PaletteTone = (typeof PALETTE_TONE)[keyof typeof PALETTE_TONE];

/**
 * A face family and the CSS variable that carries it. DM Sans is the root layout's own body
 * face (Q30), so it rides the variable the root already sets.
 */
export const FACE_VARIABLE = {
  "Space Grotesk": "--font-space-grotesk",
  "Geist Mono": "--font-geist-mono",
  Jost: "--font-jost",
  "Cormorant Garamond": "--font-cormorant-garamond",
  "DM Sans": "--font-body-face",
  "DM Mono": "--font-dm-mono",
  Mulish: "--font-mulish",
} as const;
export type FaceFamily = keyof typeof FACE_VARIABLE;

export interface PaletteDefinition {
  key: PaletteKey;
  label: string;
  tone: PaletteTone;
}

export interface ThemeDefinition {
  key: ThemeKey;
  /** The name a shop sees (Q18) and the owner's words beneath it. */
  label: string;
  description: string;
  /** Display, body and label faces; at most two families between them (Q7, Q30). */
  faces: { display: FaceFamily; body: FaceFamily; label: FaceFamily };
  /** Product columns on a phone (spec Theme cards: Daily is dense). */
  phoneColumns: 2 | 3;
  /** Exactly three, the first being the default (own-store Q15). */
  palettes: readonly [PaletteDefinition, PaletteDefinition, PaletteDefinition];
}

export const THEMES: Record<ThemeKey, ThemeDefinition> = {
  [THEME.EDGE]: {
    key: THEME.EDGE,
    label: "Edge",
    description: "Fancy & futuristic",
    faces: { display: "Space Grotesk", body: "Space Grotesk", label: "Geist Mono" },
    phoneColumns: 2,
    palettes: [
      { key: PALETTE.CARBON, label: "Carbon", tone: PALETTE_TONE.DARK },
      { key: PALETTE.GRAPHITE, label: "Graphite", tone: PALETTE_TONE.DARK },
      { key: PALETTE.SIGNAL, label: "Signal", tone: PALETTE_TONE.LIGHT },
    ],
  },
  [THEME.DARBAR]: {
    key: THEME.DARBAR,
    label: "Darbar",
    description: "Royal & traditional",
    faces: { display: "Jost", body: "Jost", label: "Cormorant Garamond" },
    phoneColumns: 2,
    palettes: [
      { key: PALETTE.EMERALD, label: "Ivory & emerald", tone: PALETTE_TONE.LIGHT },
      { key: PALETTE.NAVY, label: "Ivory & navy", tone: PALETTE_TONE.LIGHT },
      { key: PALETTE.KUMKUM, label: "Kumkum", tone: PALETTE_TONE.LIGHT },
    ],
  },
  [THEME.BLOOM]: {
    key: THEME.BLOOM,
    label: "Bloom",
    description: "Young & beautiful",
    faces: { display: "DM Sans", body: "DM Sans", label: "DM Mono" },
    phoneColumns: 2,
    palettes: [
      { key: PALETTE.BLUSH, label: "Blush", tone: PALETTE_TONE.LIGHT },
      { key: PALETTE.PEACH, label: "Peach", tone: PALETTE_TONE.LIGHT },
      { key: PALETTE.LILAC, label: "Lilac", tone: PALETTE_TONE.LIGHT },
    ],
  },
  [THEME.DAILY]: {
    key: THEME.DAILY,
    label: "Daily",
    description: "Affordable & everyday",
    faces: { display: "Mulish", body: "Mulish", label: "Mulish" },
    phoneColumns: 3,
    palettes: [
      { key: PALETTE.FRESH, label: "Fresh", tone: PALETTE_TONE.LIGHT },
      { key: PALETTE.BAZAAR, label: "Bazaar", tone: PALETTE_TONE.LIGHT },
      { key: PALETTE.COBALT, label: "Cobalt", tone: PALETTE_TONE.LIGHT },
    ],
  },
};

export interface StorefrontLook {
  theme: ThemeKey;
  palette: PaletteKey;
}

/**
 * Stored keys parsed on read (D1). An unknown theme reads as unthemed (`null`), so a key
 * retired from code falls back to today's pages; a palette not of that theme reads as the
 * theme's first, so a look is never half-applied.
 */
export function readStorefrontLook(themeKey: unknown, paletteKey: unknown): StorefrontLook | null {
  const theme = THEME_KEYS.find((key) => key === themeKey);
  if (!theme) return null;
  const palettes = THEMES[theme].palettes;
  const palette = palettes.find((p) => p.key === paletteKey) ?? palettes[0];
  return { theme, palette: palette.key };
}

/**
 * The one section library (Q8; D8, ADR-0064). Every theme composes these and only these, so
 * no component exists for one theme (R2). The footer and its platform band are chrome (D7),
 * drawn by the themed layout rather than composed.
 */
export const SECTION = {
  HERO: "hero",
  COLLECTIONS: "collections",
  DEALS: "deals",
  BEST_SELLING: "bestSelling",
  NEW_IN: "newIn",
  WHY_BUY: "whyBuy",
  STORY: "story",
  REVIEWS: "reviews",
  VISIT: "visit",
} as const;
export type SectionKey = (typeof SECTION)[keyof typeof SECTION];
export const SECTION_KEYS = Object.values(SECTION) as [SectionKey, ...SectionKey[]];

export const SECTION_VARIANTS = {
  [SECTION.HERO]: ["fullBleed", "ribbon", "split", "banner"],
  [SECTION.COLLECTIONS]: ["rail", "editorial", "circles"],
  [SECTION.DEALS]: ["campaign", "banners", "strip"],
  [SECTION.BEST_SELLING]: ["grid", "rail", "byCategory"],
  [SECTION.NEW_IN]: ["grid", "rail"],
  [SECTION.WHY_BUY]: ["list", "tiles", "strip"],
  [SECTION.STORY]: ["plain", "dropCap", "twoColumn"],
  [SECTION.REVIEWS]: ["quotes", "highlight"],
  [SECTION.VISIT]: ["card", "inline"],
} as const satisfies Record<SectionKey, readonly string[]>;
export type SectionVariant<S extends SectionKey> = (typeof SECTION_VARIANTS)[S][number];

/**
 * What a shop may hide (Q9): sections made only of the shop's own words and picks. Proof,
 * reviews, goods and offers are derived, so a page cannot drop them when they turn
 * unflattering (brand-page R7's line, unchanged).
 */
export const HIDEABLE_SECTIONS = [
  SECTION.COLLECTIONS,
  SECTION.STORY,
  SECTION.VISIT,
] as const satisfies readonly SectionKey[];
export type HideableSection = (typeof HIDEABLE_SECTIONS)[number];

/** One product card, four styles (D8; spec Theme cards, "Card"). */
export const CARD_STYLE = {
  /** Edge: flat tile, mono spec line, no shadow. */
  TILE: "tile",
  /** Darbar: tall tile, centred caps name, tracked price. */
  TALL: "tall",
  /** Bloom: square image, rating chip. */
  SQUARE: "square",
  /** Daily: dense tile, % off chip, big price. */
  DENSE: "dense",
} as const;
export type CardStyle = (typeof CARD_STYLE)[keyof typeof CARD_STYLE];

/** A section in a theme's order, with the variant that theme draws it in. */
export type CompositionEntry = {
  [S in SectionKey]: { section: S; variant: SectionVariant<S> };
}[SectionKey];

export interface ThemeComposition {
  cardStyle: CardStyle;
  /** Top to bottom; a section absent here never renders in this theme. */
  sections: readonly CompositionEntry[];
}

/** Each theme's order (spec Theme cards, "Section order"); new in follows best selling (Q23). */
export const COMPOSITIONS: Record<ThemeKey, ThemeComposition> = {
  [THEME.EDGE]: {
    cardStyle: CARD_STYLE.TILE,
    sections: [
      { section: SECTION.HERO, variant: "fullBleed" },
      { section: SECTION.COLLECTIONS, variant: "rail" },
      { section: SECTION.DEALS, variant: "campaign" },
      { section: SECTION.BEST_SELLING, variant: "grid" },
      { section: SECTION.NEW_IN, variant: "grid" },
      { section: SECTION.STORY, variant: "plain" },
      { section: SECTION.WHY_BUY, variant: "list" },
      { section: SECTION.REVIEWS, variant: "quotes" },
      { section: SECTION.VISIT, variant: "card" },
    ],
  },
  [THEME.DARBAR]: {
    cardStyle: CARD_STYLE.TALL,
    sections: [
      { section: SECTION.HERO, variant: "ribbon" },
      { section: SECTION.COLLECTIONS, variant: "editorial" },
      { section: SECTION.DEALS, variant: "banners" },
      { section: SECTION.BEST_SELLING, variant: "grid" },
      { section: SECTION.NEW_IN, variant: "grid" },
      { section: SECTION.STORY, variant: "dropCap" },
      { section: SECTION.WHY_BUY, variant: "tiles" },
      { section: SECTION.REVIEWS, variant: "quotes" },
      { section: SECTION.VISIT, variant: "inline" },
    ],
  },
  [THEME.BLOOM]: {
    cardStyle: CARD_STYLE.SQUARE,
    sections: [
      { section: SECTION.HERO, variant: "split" },
      { section: SECTION.COLLECTIONS, variant: "circles" },
      { section: SECTION.BEST_SELLING, variant: "rail" },
      { section: SECTION.NEW_IN, variant: "rail" },
      { section: SECTION.DEALS, variant: "strip" },
      { section: SECTION.STORY, variant: "twoColumn" },
      { section: SECTION.REVIEWS, variant: "highlight" },
      { section: SECTION.WHY_BUY, variant: "strip" },
      { section: SECTION.VISIT, variant: "card" },
    ],
  },
  [THEME.DAILY]: {
    cardStyle: CARD_STYLE.DENSE,
    sections: [
      { section: SECTION.HERO, variant: "banner" },
      { section: SECTION.COLLECTIONS, variant: "circles" },
      { section: SECTION.DEALS, variant: "banners" },
      { section: SECTION.BEST_SELLING, variant: "byCategory" },
      { section: SECTION.NEW_IN, variant: "rail" },
      { section: SECTION.WHY_BUY, variant: "strip" },
      { section: SECTION.STORY, variant: "plain" },
      { section: SECTION.VISIT, variant: "inline" },
    ],
  },
};
