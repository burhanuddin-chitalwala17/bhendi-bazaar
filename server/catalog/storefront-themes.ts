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
export const PALETTE_KEYS = Object.values(PALETTE) as [PaletteKey, ...PaletteKey[]];

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
  // The root layout's heading face, already on every page (storefront-font D2).
  "Playfair Display": "--font-heading-face",
  Marcellus: "--font-marcellus",
  Poppins: "--font-poppins",
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
  /** Product types this theme is suggested for (Q19, Q44); a type sits under one theme at most. */
  suggestedFor: readonly string[];
}

export const THEMES: Record<ThemeKey, ThemeDefinition> = {
  [THEME.EDGE]: {
    key: THEME.EDGE,
    label: "Edge",
    description: "Fancy & futuristic",
    faces: { display: "Space Grotesk", body: "Space Grotesk", label: "Geist Mono" },
    phoneColumns: 2,
    suggestedFor: ["bag", "travel-pouch"],
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
    suggestedFor: ["jewellery", "islamic-wear", "prayer-mat", "fragrance"],
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
    suggestedFor: ["combo"],
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
    suggestedFor: ["socks", "trousers"],
    palettes: [
      { key: PALETTE.FRESH, label: "Fresh", tone: PALETTE_TONE.LIGHT },
      { key: PALETTE.BAZAAR, label: "Bazaar", tone: PALETTE_TONE.LIGHT },
      { key: PALETTE.COBALT, label: "Cobalt", tone: PALETTE_TONE.LIGHT },
    ],
  },
};

/**
 * The heading faces a shop may choose (storefront-font D1, Q1, Q4). A key is stored, never a family;
 * a font changes the face only, so sizes, weight and case stay the theme's (R3, ADR-0064 D5).
 */
export const FONT = {
  SPACE: "space",
  JOST: "jost",
  DM_SANS: "dmsans",
  MULISH: "mulish",
  POPPINS: "poppins",
  CORMORANT: "cormorant",
  PLAYFAIR: "playfair",
  MARCELLUS: "marcellus",
} as const;
export type FontKey = (typeof FONT)[keyof typeof FONT];
export const FONT_KEYS = Object.values(FONT) as [FontKey, ...FontKey[]];

export interface FontDefinition {
  key: FontKey;
  family: FaceFamily;
  /** The variable the scope reads. Its own, never a role a theme repoints (`--font-body-face` is Jost in Darbar). */
  variable: string;
  /** What the shop reads under the sample, in its own words ("Serif · carved caps"). */
  kind: string;
}

export const FONTS: Record<FontKey, FontDefinition> = {
  [FONT.SPACE]: { key: FONT.SPACE, family: "Space Grotesk", variable: "--font-space-grotesk", kind: "Sans · geometric" },
  [FONT.JOST]: { key: FONT.JOST, family: "Jost", variable: "--font-jost", kind: "Sans · classic" },
  [FONT.DM_SANS]: { key: FONT.DM_SANS, family: "DM Sans", variable: "--font-dm-sans", kind: "Sans · friendly" },
  [FONT.MULISH]: { key: FONT.MULISH, family: "Mulish", variable: "--font-mulish", kind: "Sans · plain" },
  [FONT.POPPINS]: { key: FONT.POPPINS, family: "Poppins", variable: "--font-poppins", kind: "Sans · round" },
  [FONT.CORMORANT]: { key: FONT.CORMORANT, family: "Cormorant Garamond", variable: "--font-cormorant-garamond", kind: "Serif · elegant" },
  [FONT.PLAYFAIR]: { key: FONT.PLAYFAIR, family: "Playfair Display", variable: "--font-heading-face", kind: "Serif · bold" },
  [FONT.MARCELLUS]: { key: FONT.MARCELLUS, family: "Marcellus", variable: "--font-marcellus", kind: "Serif · carved caps" },
};

/** Shown first, marked Suggested, the theme's own face leading (storefront-font R4; prototype). */
export const SUGGESTED_FONTS: Record<ThemeKey, readonly FontKey[]> = {
  [THEME.EDGE]: [FONT.SPACE, FONT.POPPINS, FONT.DM_SANS],
  [THEME.DARBAR]: [FONT.JOST, FONT.MARCELLUS, FONT.CORMORANT, FONT.PLAYFAIR],
  [THEME.BLOOM]: [FONT.DM_SANS, FONT.POPPINS, FONT.PLAYFAIR, FONT.CORMORANT],
  [THEME.DAILY]: [FONT.MULISH, FONT.POPPINS, FONT.DM_SANS],
};

/** The template's own display face as a key: what "Template default" means. */
export function defaultFont(theme: ThemeKey): FontKey {
  const family = THEMES[theme].faces.display;
  return FONT_KEYS.find((key) => FONTS[key].family === family) ?? FONT.DM_SANS;
}

/** A stored key parsed on read (Q7): unknown or absent reads as the template's default. */
export function readFontKey(value: unknown): FontKey | null {
  return FONT_KEYS.find((key) => key === value) ?? null;
}

/** The theme a shop that mostly sells this product type is shown as "Suggested" (Q19). */
export function suggestedTheme(productType: string | null): ThemeKey | null {
  if (!productType) return null;
  return THEME_KEYS.find((theme) => THEMES[theme].suggestedFor.includes(productType)) ?? null;
}

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

/** What a section's sheet asks (D13; Q9, Q10): the registry's editor fields, nothing else. */
export const EDITOR_FIELD = {
  HERO_PHOTOS: "heroPhotos",
  HERO_LINE: "heroLine",
  COLLECTIONS: "collections",
  CLAIMS: "claims",
  OPENING_HOURS: "openingHours",
} as const;
export type EditorField = (typeof EDITOR_FIELD)[keyof typeof EDITOR_FIELD];

/**
 * Each section's own fields. Story and visit draw facts Shop details owns (org-profile's
 * boundary), so their sheets link there; a section listed with none is one the shop can only hide.
 */
export const SECTION_FIELDS: Partial<Record<SectionKey, readonly EditorField[]>> = {
  [SECTION.HERO]: [EDITOR_FIELD.HERO_PHOTOS, EDITOR_FIELD.HERO_LINE],
  [SECTION.COLLECTIONS]: [EDITOR_FIELD.COLLECTIONS],
  [SECTION.WHY_BUY]: [EDITOR_FIELD.CLAIMS],
  [SECTION.STORY]: [],
  [SECTION.VISIT]: [EDITOR_FIELD.OPENING_HOURS],
};

/** A tap opens a sheet only on a section the shop has something to change in. */
export function isEditableSection(section: string): section is SectionKey {
  return section in SECTION_FIELDS;
}

export const isHideableSection = (section: string): section is HideableSection =>
  (HIDEABLE_SECTIONS as readonly string[]).includes(section);

/** Stored hidden-section keys parsed on read: an unknown key is dropped. */
export function readHiddenSections(value: unknown): HideableSection[] {
  return Array.isArray(value) ? [...new Set(value.filter((k): k is HideableSection => typeof k === "string" && isHideableSection(k)))] : [];
}

/** Q10: up to three hero photos, up to six collections. */
export const HERO_PHOTOS_MAX = 3;
export const COLLECTIONS_MAX = 6;
export const HERO_LINE_MAX = 120;

/** Q23: a landing page sells the shop; the grid lives one tap away. */
export const LANDING_SHELF_LIMIT = 8;

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
