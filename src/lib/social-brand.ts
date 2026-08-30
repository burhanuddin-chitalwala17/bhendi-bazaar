/**
 * The one place a third-party brand colour becomes CSS. These are not ours to
 * theme — Facebook blue is Facebook blue in either mode — so they sit outside the
 * semantic token system on purpose, and are kept here rather than at the call site
 * so the design-token test has exactly one file to excuse.
 *
 * X is the exception: its mark is pure black, which disappears on a dark ground, so
 * it takes `foreground` and inverts with the theme like any other icon.
 */
export const SOCIAL_BRAND = {
  facebook: { color: "text-[#1877F2]", hover: "hover:bg-[#1877F2]/10" },
  twitter: { color: "text-foreground", hover: "hover:bg-muted" },
  whatsapp: { color: "text-[#25D366]", hover: "hover:bg-[#25D366]/10" },
  linkedin: { color: "text-[#0A66C2]", hover: "hover:bg-[#0A66C2]/10" },
  instagram: { color: "text-[#E4405F]", hover: "hover:bg-[#E4405F]/10" },
  email: { color: "text-muted-foreground", hover: "hover:bg-muted" },
} as const satisfies Record<string, { color: string; hover: string }>;
