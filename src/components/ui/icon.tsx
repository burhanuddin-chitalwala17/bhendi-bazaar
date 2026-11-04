import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { BRAND_ICONS, BrandGlyph, type BrandIconName } from "./icons/brand";
import { ICONS, type LibraryIconName } from "./icons/registry";

/** A brand drawing wins over the library's for the same meaning (ADR-0066 D3). */
export type IconName = LibraryIconName | BrandIconName;

const SIZE_PX = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32, "2xl": 48 } as const;

const iconVariants = cva("inline-block shrink-0", {
  variants: {
    // Colour as a role; `current` inherits from the text it sits in.
    tone: {
      current: "",
      muted: "text-muted-foreground",
      primary: "text-primary",
      success: "text-success",
      warning: "text-warning",
      destructive: "text-destructive",
      deal: "text-deal",
    },
  },
  defaultVariants: { tone: "current" },
});

export interface IconProps extends VariantProps<typeof iconVariants> {
  name: IconName;
  size?: keyof typeof SIZE_PX;
  /** Its spoken name, when the icon is the only label of what it sits in. Without it, it is decoration. */
  label?: string;
  /** The selected state: a tab you are on, a product you saved. */
  filled?: boolean;
  /** Plays the drawing's one motion (brand icons only); reduced motion turns it off in CSS. */
  motion?: boolean;
  /** Layout only: margin, alignment. Size and colour come from props. */
  className?: string;
}

/**
 * The one way to draw an icon (ADR-0066 D3–D5). Weight follows size, as optical sizing does:
 * regular below 20px so a 16px glyph keeps its line, light above for the calmer large mark (Q11).
 */
export function Icon({ name, size = "sm", tone, label, filled, motion, className }: IconProps) {
  const px = SIZE_PX[size];
  const classes = cn(iconVariants({ tone }), className);

  if (name in BRAND_ICONS) {
    return <BrandGlyph name={name as BrandIconName} px={px} filled={filled} motion={motion} className={classes} label={label} />;
  }

  const Glyph = ICONS[name as LibraryIconName];
  return (
    <Glyph
      size={px}
      weight={filled ? "fill" : px < 20 ? "regular" : "light"}
      className={classes}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}

export const ICON_SIZES = SIZE_PX;
