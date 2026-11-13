"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lookPreviewHref } from "@/components/storefront/preview/preview-href";
import { THEMES, type FontKey, type PaletteKey, type ThemeKey } from "@server/catalog/storefront-themes";
import { FontPicker } from "./look-font-picker";
import { LOOK_COPY } from "./look-copy";
import { LookFrame } from "./look-frame";
import { PaletteDots } from "./palette-dots";

/** One theme on the picker (ux.md picker): a live mini-preview of the shop's own page, its palettes, "Preview". */
export function ThemeCard({
  orgId,
  shopName,
  theme,
  palette,
  font,
  live,
  suggestedFor,
  onPalette,
  onFont,
  onPreview,
}: {
  orgId: string;
  shopName: string;
  theme: ThemeKey;
  palette: PaletteKey;
  /** The heading face being tried; null is the template's own (storefront-font D7). */
  font: FontKey | null;
  /** This theme is what buyers see now. */
  live: boolean;
  /** What the shop mostly sells, when this is the theme suggested for it (Q19). */
  suggestedFor?: string;
  onPalette: (palette: PaletteKey) => void;
  onFont: (font: FontKey | null) => void;
  onPreview: () => void;
}) {
  const definition = THEMES[theme];
  return (
    <article className="flex h-full flex-col gap-3 rounded-card border border-border bg-card p-3">
      <LookFrame
        src={lookPreviewHref(orgId, theme, palette, undefined, 0, font)}
        theme={theme}
        palette={palette}
        title={definition.label}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-medium text-foreground">{definition.label}</h2>
          <p className="text-sm text-muted-foreground">{definition.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {live && <Badge>{LOOK_COPY.liveNow}</Badge>}
          {suggestedFor && <Badge variant="outline">{LOOK_COPY.suggestedFor(suggestedFor)}</Badge>}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <PaletteDots theme={theme} value={palette} onChange={onPalette} />
        <Button type="button" variant="outline" className="min-h-11" onClick={onPreview}>
          {LOOK_COPY.preview}
        </Button>
      </div>
      <FontPicker theme={theme} shopName={shopName} value={font} onChange={onFont} />
    </article>
  );
}
