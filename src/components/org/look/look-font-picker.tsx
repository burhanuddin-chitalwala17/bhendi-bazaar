"use client";

import { useState } from "react";

import { ResponsivePicker } from "@/components/shared/overlays/responsive-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  FONT_KEYS,
  FONTS,
  SUGGESTED_FONTS,
  THEMES,
  defaultFont,
  type FontKey,
  type ThemeKey,
} from "@server/catalog/storefront-themes";
import { FONT_CLASSES } from "@/components/storefront/theme-fonts";
import { FONT_COPY, sampleName } from "./look-font-copy";

/**
 * The heading face on a theme card (storefront-font D7, Q9; ux.md Look and Font sheet). A value picked
 * from a set, so a bottom sheet on a phone and a popover from `md:` (ADR-0040 decision 1). Each option
 * is the shop's own name set in that face, inside a `[data-font]` scope, so the sample is the face the
 * store will draw rather than a family named here.
 */
export function FontPicker({
  theme,
  shopName,
  value,
  onChange,
}: {
  theme: ThemeKey;
  shopName: string;
  /** Null is the template's own face. */
  value: FontKey | null;
  onChange: (font: FontKey | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const own = defaultFont(theme);
  const shown = value ?? own;
  const suggested = SUGGESTED_FONTS[theme];
  const more = FONT_KEYS.filter((key) => !suggested.includes(key));
  // A face picked is kept across templates, even a template's own (R6); only "Use template default" clears it.
  const pick = (font: FontKey | null) => {
    onChange(font);
    setOpen(false);
  };

  return (
    <ResponsivePicker
      open={open}
      onOpenChange={setOpen}
      title={FONT_COPY.title}
      description={FONT_COPY.help}
      className="max-h-overlay w-96 overflow-y-auto"
      trigger={
        <Button
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="h-auto min-h-11 w-full justify-between gap-2 whitespace-normal py-2 text-left font-normal"
        >
          <span className="min-w-0">
            <span className="block text-caption text-muted-foreground">{FONT_COPY.row}</span>
            <FontSample font={shown} className="block truncate text-body">
              {FONTS[shown].family}
            </FontSample>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {value === null && <Badge variant="outline">{FONT_COPY.templateDefault}</Badge>}
            <Icon name="choose" size="sm" className="text-muted-foreground" />
          </span>
        </Button>
      }
    >
      <p className="hidden text-small text-muted-foreground md:block">{FONT_COPY.help}</p>
      <FontGroup
        label={FONT_COPY.suggestedFor(THEMES[theme].label)}
        fonts={suggested}
        own={own}
        shown={shown}
        shopName={shopName}
        onPick={pick}
      />
      <FontGroup label={FONT_COPY.more} fonts={more} own={own} shown={shown} shopName={shopName} onPick={pick} />
      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => pick(null)}>
        {FONT_COPY.useDefault}
      </Button>
    </ResponsivePicker>
  );
}

function FontGroup({
  label,
  fonts,
  own,
  shown,
  shopName,
  onPick,
}: {
  label: string;
  fonts: readonly FontKey[];
  own: FontKey;
  shown: FontKey;
  shopName: string;
  onPick: (font: FontKey) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-label uppercase text-muted-foreground">{label}</p>
      <ul aria-label={label} className="space-y-1.5">
        {fonts.map((font) => {
          const chosen = font === shown;
          return (
            <li key={font}>
              <Button
                type="button"
                variant="outline"
                aria-pressed={chosen}
                aria-label={`${FONTS[font].family}, ${FONTS[font].kind}`}
                onClick={() => onPick(font)}
                className={cn(
                  "h-auto min-h-14 w-full justify-between gap-3 whitespace-normal px-3 py-2 text-left font-normal",
                  chosen && "border-primary bg-accent",
                )}
              >
                <span className="min-w-0">
                  <FontSample font={font} className="block truncate text-title">
                    {sampleName(shopName)}
                  </FontSample>
                  <span className="block text-caption text-muted-foreground">
                    {FONTS[font].family} · {FONTS[font].kind}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {font === own && <Badge variant="outline">{FONT_COPY.templateDefault}</Badge>}
                  {chosen && <Icon name="success" size="sm" />}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Text in a face through its scope and loader class, never a family typed here (ADR-0064 D5). */
function FontSample({ font, className, children }: { font: FontKey; className?: string; children: React.ReactNode }) {
  return (
    <span data-font={font} className={cn(FONT_CLASSES[font], "font-display", className)}>
      {children}
    </span>
  );
}
