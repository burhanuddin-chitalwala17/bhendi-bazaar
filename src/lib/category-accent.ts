import { CategoryAccent } from "@prisma/client";

/**
 * The one place a category accent becomes CSS. Rows store the semantic key
 * (`CategoryAccent`); these class strings exist only here, so a palette change is an
 * edit to this table — not a data migration, which is what storing the classes in the
 * database made it.
 *
 * This file is deliberately the design-tokens test's allowlisted exception: the accent
 * palette is a closed decorative set keyed by data, and keeping the literals in one
 * statically-scanned module is what lets Tailwind generate them reliably.
 */
export const CATEGORY_ACCENTS: Record<
  CategoryAccent,
  { label: string; swatch: string; heroGradient: string }
> = {
  EMERALD: {
    label: "Emerald",
    swatch: "bg-emerald-100",
    heroGradient: "from-emerald-900/80 via-emerald-800/60 to-scrim/80",
  },
  BLUE: {
    label: "Blue",
    swatch: "bg-sky-100",
    heroGradient: "from-sky-900/80 via-sky-800/60 to-scrim/80",
  },
  PURPLE: {
    label: "Purple",
    swatch: "bg-purple-100",
    heroGradient: "from-purple-900/80 via-purple-800/60 to-scrim/80",
  },
  PINK: {
    label: "Pink",
    swatch: "bg-pink-100",
    heroGradient: "from-pink-900/80 via-pink-800/60 to-scrim/80",
  },
  ORANGE: {
    label: "Orange",
    swatch: "bg-amber-100",
    heroGradient: "from-amber-900/80 via-amber-800/60 to-scrim/80",
  },
  YELLOW: {
    label: "Yellow",
    swatch: "bg-yellow-100",
    heroGradient: "from-yellow-900/80 via-yellow-800/60 to-scrim/80",
  },
  RED: {
    label: "Red",
    swatch: "bg-red-100",
    heroGradient: "from-red-900/80 via-red-800/60 to-scrim/80",
  },
  GRAY: {
    label: "Gray",
    swatch: "bg-gray-100",
    heroGradient: "from-gray-800/80 via-gray-700/60 to-scrim/80",
  },
};

export const CATEGORY_ACCENT_KEYS = Object.keys(CATEGORY_ACCENTS) as CategoryAccent[];
