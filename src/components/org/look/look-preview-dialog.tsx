"use client";

import { useEffect, useState } from "react";

import { TaskDialog } from "@/components/shared/overlays/task-dialog";
import { Button } from "@/components/ui/button";
import {
  lookPreviewHref,
  PREVIEW_VIEW,
  type PreviewView,
} from "@/components/storefront/preview/preview-href";
import {
  THEMES,
  type FontKey,
  type PaletteKey,
  type ThemeKey,
} from "@server/catalog/storefront-themes";
import { LOOK_COPY } from "./look-copy";
import { FRAME_DEVICE, LookFrame } from "./look-frame";
import { PaletteDots } from "./palette-dots";
import { PREVIEW_MESSAGE } from "@/components/storefront/preview/preview-frame-guard";
import { isEditableSection, type SectionKey } from "@server/catalog/storefront-themes";
import { SECTION_COPY } from "./section-copy";
import { SectionSheet } from "./section-sheet";

const TAP_HINT_KEY = "bb.look.tap-hint-seen";

/** ux.md preview, First use: "Tap any part to change it." once per browser; storage may be missing. */
function useTapHintOnce() {
  // The dialog opens only on a tap, so this first render is always in the browser.
  const [show] = useState(() => {
    try {
      return !window.localStorage.getItem(TAP_HINT_KEY);
    } catch {
      return true; // No storage: show it, and accept showing it again next time.
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(TAP_HINT_KEY, "1");
    } catch {
      // Nothing to remember it in.
    }
  }, []);
  return show;
}

/**
 * A tapped section in the preview frame (D12, D13), from our own origin only: the frame posts its
 * key, and a section with something to change opens its sheet.
 */
function useTappedSection() {
  const [section, setSection] = useState<SectionKey | null>(null);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: unknown; section?: unknown } | null;
      if (data?.type !== PREVIEW_MESSAGE.SECTION || typeof data.section !== "string") return;
      if (isEditableSection(data.section)) setSection(data.section);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return [section, setSection] as const;
}

/**
 * The full-screen preview (ux.md: live preview & publish; ADR-0040 case 2): the shop's own page in
 * the theme, its palette dots, the Landing / Shop switch, and "Publish this look". A phone gets
 * the whole screen; at `md:` the controls sit in a column beside the phone frame; from `lg:` the
 * desktop page sits beside the phone and the controls return above (D12).
 */
export function LookPreviewDialog({
  orgId,
  theme,
  palette,
  font,
  view,
  onPalette,
  onView,
  onPublish,
  onClose,
}: {
  orgId: string;
  theme: ThemeKey;
  palette: PaletteKey;
  /** The heading face being tried (storefront-font D7). */
  font: FontKey | null;
  view: PreviewView;
  onPalette: (palette: PaletteKey) => void;
  onView: (view: PreviewView) => void;
  onPublish: () => void;
  onClose: () => void;
}) {
  const [section, setSection] = useTappedSection();
  const [revision, setRevision] = useState(0);
  const tapHint = useTapHintOnce();
  const src = lookPreviewHref(orgId, theme, palette, view, revision, font);
  const name = THEMES[theme].label;
  return (
    <TaskDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={name}
      description={THEMES[theme].description}
      width="gallery"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:grid md:grid-cols-[1fr_14rem] md:grid-rows-[auto_1fr] lg:flex lg:flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 md:col-start-2 md:row-start-1 md:flex-col md:items-start lg:flex-row lg:items-center">
          <PaletteDots theme={theme} value={palette} onChange={onPalette} />
          <div role="group" className="flex gap-1">
            {[
              { key: PREVIEW_VIEW.LANDING, label: LOOK_COPY.landing },
              { key: PREVIEW_VIEW.SHOP, label: LOOK_COPY.shop },
            ].map((option) => (
              <Button
                key={option.key}
                type="button"
                size="sm"
                variant={view === option.key ? "default" : "outline"}
                aria-pressed={view === option.key}
                className="min-h-11"
                onClick={() => onView(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {tapHint && <p className="basis-full text-sm text-muted-foreground">{SECTION_COPY.tapToChange}</p>}
        </div>
        <div className="flex min-h-0 flex-1 items-start justify-center gap-4 overflow-y-auto md:col-start-1 md:row-span-2 md:row-start-1">
          <LookFrame
            src={src}
            theme={theme}
            palette={palette}
            title={name}
            failedCopy={LOOK_COPY.previewFailed}
            className="max-w-sm"
          />
          <LookFrame
            src={src}
            theme={theme}
            palette={palette}
            title={name}
            device={FRAME_DEVICE.DESKTOP}
            failedCopy={LOOK_COPY.previewFailed}
            className="hidden lg:block"
          />
        </div>
        <Button
          type="button"
          size="lg"
          className="min-h-11 w-full shrink-0 md:col-start-2 md:row-start-2 md:self-start"
          onClick={onPublish}
        >
          {LOOK_COPY.publishThisLook}
        </Button>
      </div>
      {section && (
        <SectionSheet
          orgId={orgId}
          section={section}
          onClose={() => setSection(null)}
          onSaved={() => {
            setSection(null);
            setRevision((n) => n + 1);
          }}
        />
      )}
    </TaskDialog>
  );
}
