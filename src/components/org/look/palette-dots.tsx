"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { THEMES, type PaletteKey, type ThemeKey } from "@server/catalog/storefront-themes";
import { LOOK_COPY } from "./look-copy";

/**
 * A theme's three palettes as dots (own-store Q15; ux.md journey 1). Each dot is drawn inside its
 * own palette scope, so it shows that palette's ground and primary rather than a colour typed here.
 */
export function PaletteDots({
  theme,
  value,
  onChange,
}: {
  theme: ThemeKey;
  value: PaletteKey;
  onChange: (palette: PaletteKey) => void;
}) {
  return (
    <div role="radiogroup" aria-label={LOOK_COPY.palette} className="flex items-center gap-1">
      {THEMES[theme].palettes.map((palette) => {
        const chosen = palette.key === value;
        return (
          <Button
            key={palette.key}
            type="button"
            variant="ghost"
            size="icon"
            role="radio"
            aria-checked={chosen}
            aria-label={palette.label}
            title={palette.label}
            onClick={() => onChange(palette.key)}
            className="size-11 rounded-full"
          >
            <span
              data-theme={theme}
              data-palette={palette.key}
              aria-hidden
              className={cn(
                "flex size-7 items-center justify-center rounded-full border border-border bg-background",
                chosen && "ring-2 ring-ring ring-offset-2 ring-offset-background",
              )}
            >
              <span className="size-3.5 rounded-full bg-primary" />
            </span>
          </Button>
        );
      })}
    </div>
  );
}
