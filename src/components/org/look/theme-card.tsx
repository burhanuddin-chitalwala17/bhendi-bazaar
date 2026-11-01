"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lookPreviewHref } from "@/components/storefront/preview/preview-href";
import { THEMES, type PaletteKey, type ThemeKey } from "@server/catalog/storefront-themes";
import { LOOK_COPY } from "./look-copy";
import { LookFrame } from "./look-frame";
import { PaletteDots } from "./palette-dots";

/** One theme on the picker (ux.md picker): a live mini-preview of the shop's own page, its palettes, "Preview". */
export function ThemeCard({
  orgId,
  theme,
  palette,
  live,
  onPalette,
  onPreview,
}: {
  orgId: string;
  theme: ThemeKey;
  palette: PaletteKey;
  /** This theme is what buyers see now. */
  live: boolean;
  onPalette: (palette: PaletteKey) => void;
  onPreview: () => void;
}) {
  const definition = THEMES[theme];
  return (
    <article className="flex h-full flex-col gap-3 rounded-card border border-border bg-card p-3">
      <LookFrame src={lookPreviewHref(orgId, theme, palette)} theme={theme} palette={palette} title={definition.label} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-medium text-foreground">{definition.label}</h2>
          <p className="text-sm text-muted-foreground">{definition.description}</p>
        </div>
        {live && <Badge>{LOOK_COPY.liveNow}</Badge>}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <PaletteDots theme={theme} value={palette} onChange={onPalette} />
        <Button type="button" variant="outline" className="min-h-11" onClick={onPreview}>
          {LOOK_COPY.preview}
        </Button>
      </div>
    </article>
  );
}
