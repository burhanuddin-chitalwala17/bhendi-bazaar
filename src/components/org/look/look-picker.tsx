"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";

import { Button } from "@/components/ui/button";
import { ShareShopSheet } from "@/components/org/share/share-shop-sheet";
import { orgStorefrontApiClient } from "@/components/org/orgStorefrontApiClient";
import { PREVIEW_VIEW, type PreviewView } from "@/components/storefront/preview/preview-href";
import type { ShareShop } from "@/lib/store-preview";
import { THEME_KEYS, THEMES, type PaletteKey, type ThemeKey } from "@server/catalog/storefront-themes";
import { lookName, type StorefrontLookState } from "@server/catalog/storefront-look.types";
import { LOOK_COPY } from "./look-copy";
import { LookConfirmDialog } from "./look-confirm-dialog";
import { LookPreviewDialog } from "./look-preview-dialog";
import { ThemeCard } from "./theme-card";
import { useLookWrite } from "./useLookWrite";

/** The palette a card opens on: the live one for the live theme, else the theme's first. */
function startingPalettes(look: StorefrontLookState): Record<ThemeKey, PaletteKey> {
  return Object.fromEntries(
    THEME_KEYS.map((theme) => [
      theme,
      look.live.theme === theme && look.live.palette ? look.live.palette : THEMES[theme].palettes[0].key,
    ]),
  ) as Record<ThemeKey, PaletteKey>;
}

/**
 * The look picker (storefront-themes ux.md; R1, R3, R4, A2): four themes, each a live preview of
 * the shop's own page, a full-screen preview, Publish, and Switch back while the old look is kept.
 */
export function LookPicker({ look, share }: { look: StorefrontLookState; share: ShareShop | null }) {
  const [palettes, setPalettes] = useState(() => startingPalettes(look));
  const [previewing, setPreviewing] = useState<ThemeKey | null>(null);
  const [view, setView] = useState<PreviewView>(PREVIEW_VIEW.LANDING);
  const [confirming, setConfirming] = useState(false);
  const [switchingBack, setSwitchingBack] = useState(false);
  const [published, setPublished] = useState(false);

  const current = lookName(look.live.theme);
  const setPalette = (theme: ThemeKey) => (palette: PaletteKey) => setPalettes((all) => ({ ...all, [theme]: palette }));

  const publish = useLookWrite(
    () =>
      orgStorefrontApiClient.publishLook(look.orgId, {
        theme: previewing!,
        palette: palettes[previewing!],
        lookVersion: look.lookVersion,
      }),
    () => {
      setConfirming(false);
      setPreviewing(null);
      setPublished(true);
      toast.success(LOOK_COPY.published);
    },
  );

  const previous = look.previous;
  const revert = useLookWrite(
    () => orgStorefrontApiClient.revertLook(look.orgId, look.lookVersion),
    (now) => {
      setSwitchingBack(false);
      toast.success(LOOK_COPY.switchedBack(lookName(now.live.theme)));
    },
  );

  /** "See it": the look another member published, in the preview (ux.md journey 4). */
  const seeLive = () => {
    setConfirming(false);
    setSwitchingBack(false);
    publish.reset();
    revert.reset();
    const live = look.live;
    if (live.theme && live.palette) {
      setPalettes((all) => ({ ...all, [live.theme!]: live.palette! }));
      setPreviewing(live.theme);
    } else {
      setPreviewing(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{LOOK_COPY.intro}</p>

      {(previous || (published && share)) && (
        <div className="flex flex-wrap gap-2">
          {published && share && (
            <ShareShopSheet
              orgId={look.orgId}
              shop={share}
              setup={null}
              trigger={
                <Button type="button" className="min-h-11">
                  {LOOK_COPY.shareShop}
                </Button>
              }
            />
          )}
          {previous && (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setSwitchingBack(true)}>
              <Icon name="undo" />
              {LOOK_COPY.switchBack(lookName(previous.theme))}
            </Button>
          )}
        </div>
      )}

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {THEME_KEYS.map((theme) => (
          <li key={theme}>
            <ThemeCard
              orgId={look.orgId}
              theme={theme}
              palette={palettes[theme]}
              live={look.live.theme === theme}
              suggestedFor={look.suggested?.theme === theme ? look.suggested.label : undefined}
              onPalette={setPalette(theme)}
              onPreview={() => {
                setView(PREVIEW_VIEW.LANDING);
                setPreviewing(theme);
              }}
            />
          </li>
        ))}
      </ul>

      {previewing && (
        <LookPreviewDialog
          orgId={look.orgId}
          theme={previewing}
          palette={palettes[previewing]}
          view={view}
          onPalette={setPalette(previewing)}
          onView={setView}
          onPublish={() => setConfirming(true)}
          onClose={() => setPreviewing(null)}
        />
      )}

      {previewing && (
        <LookConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={LOOK_COPY.publishTitle(THEMES[previewing].label)}
          body={LOOK_COPY.publishBody}
          confirmLabel={LOOK_COPY.publish}
          busyLabel={LOOK_COPY.publishing}
          failedCopy={LOOK_COPY.notPublished(current)}
          anywayLabel={LOOK_COPY.publishAnyway}
          onSeeIt={seeLive}
          write={publish}
        />
      )}

      {previous && (
        <LookConfirmDialog
          open={switchingBack}
          onOpenChange={setSwitchingBack}
          title={LOOK_COPY.switchBackTitle(lookName(previous.theme))}
          body={LOOK_COPY.switchBackBody}
          confirmLabel={LOOK_COPY.switchBackConfirm}
          busyLabel={LOOK_COPY.switchingBack}
          failedCopy={LOOK_COPY.notSwitched(current)}
          anywayLabel={LOOK_COPY.switchBackConfirm}
          onSeeIt={seeLive}
          write={revert}
        />
      )}
    </div>
  );
}
