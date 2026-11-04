"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { orgStorefrontApiClient } from "@/components/org/orgStorefrontApiClient";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  storefrontSettingsSchema,
  type StorefrontSettingsInput,
} from "@/lib/validation/schemas/storefront.schema";
import type { StorefrontSettingsDto } from "@server/catalog/storefront.types";
import {
  EDITOR_FIELD,
  HERO_LINE_MAX,
  HERO_PHOTOS_MAX,
  SECTION,
  SECTION_FIELDS,
  isHideableSection,
  type SectionKey,
} from "@server/catalog/storefront-themes";
import { SECTION_COPY, SECTION_TITLE } from "./section-copy";
import { ClaimsField, CollectionsField, Counter, HideField, HoursField } from "./section-fields";
import { SlotPhotos } from "./slot-photos";
import { IMAGE_SLOT } from "@server/catalog/image-slots";
import type { ImageSlotValue } from "@server/catalog/image-framing";
import { useSectionSave, useSlow } from "./useSectionSave";
import { ROUTES } from "@server/shared/routes";

/**
 * One section's sheet over the preview (storefront-themes D13; Q9, Q10): only that section's
 * fields, from the registry, saved live at once — only the look waits for Publish (D11). A bottom
 * sheet on a phone, a side panel beside the preview from `md:` (ADR-0040 case 3).
 */
export function SectionSheet({
  orgId,
  section,
  onClose,
  onSaved,
}: {
  orgId: string;
  section: SectionKey;
  onClose: () => void;
  onSaved: () => void;
}) {
  const settings = useAsyncData((signal) => orgStorefrontApiClient.getSettings(orgId, signal));
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="adaptive">
        <SheetTitle>{SECTION_TITLE[section]}</SheetTitle>
        <SheetDescription>{SECTION_COPY.emptyHelp}</SheetDescription>
        {settings.error && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{SECTION_COPY.loadFailed}</p>
            <Button type="button" variant="outline" onClick={() => void settings.refetch()}>
              {SECTION_COPY.tryAgain}
            </Button>
          </div>
        )}
        {!settings.data && !settings.error && (
          <div className="flex justify-center text-muted-foreground">
            <Spinner size="md" />
          </div>
        )}
        {settings.data && (
          // Keyed on the version: "Load theirs" re-reads and starts the form from their words.
          <SectionForm
            key={settings.data.updatedAt}
            orgId={orgId}
            section={section}
            settings={settings.data}
            onLoadTheirs={() => void settings.refetch()}
            onSaved={onSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** The fields this section asks, and nothing else: a save sends only them and the version. */
function initialValues(section: SectionKey, s: StorefrontSettingsDto): StorefrontSettingsInput {
  const fields = SECTION_FIELDS[section] ?? [];
  return {
    expectedUpdatedAt: s.updatedAt,
    ...(fields.includes(EDITOR_FIELD.HERO_PHOTOS) && { heroImages: s.heroImages }),
    ...(fields.includes(EDITOR_FIELD.HERO_LINE) && { heroLine: s.heroLine ?? "" }),
    ...(fields.includes(EDITOR_FIELD.COLLECTIONS) && { collections: s.collections }),
    ...(fields.includes(EDITOR_FIELD.CLAIMS) && { claims: s.claims }),
    ...(fields.includes(EDITOR_FIELD.OPENING_HOURS) && { openingHours: s.openingHours }),
    ...(isHideableSection(section) && { storefrontHiddenSections: s.storefrontHiddenSections }),
  };
}

function SectionForm({
  orgId,
  section,
  settings,
  onLoadTheirs,
  onSaved,
}: {
  orgId: string;
  section: SectionKey;
  settings: StorefrontSettingsDto;
  onLoadTheirs: () => void;
  onSaved: () => void;
}) {
  const fields = SECTION_FIELDS[section] ?? [];
  const has = (field: (typeof fields)[number]) => fields.includes(field);
  const { save, stale, clearStale, currentVersion } = useSectionSave(orgId);
  const form = useServerForm<StorefrontSettingsInput>({
    schema: storefrontSettingsSchema,
    defaultValues: initialValues(section, settings),
    submit: save,
    successMessage: SECTION_COPY.saved,
    fallbackMessage: SECTION_COPY.saveFailed,
    toastErrors: false,
    onSuccess: onSaved,
  });
  const { register, watch, setValue, onSubmit, formError, isSubmitting, formState } = form;
  const errors = formState.errors;
  const slow = useSlow(isSubmitting);
  const values = watch();
  const hidden = (values.storefrontHiddenSections ?? []).includes(section as never);

  const keepMine = async () => {
    clearStale();
    setValue("expectedUpdatedAt", await currentVersion());
    await onSubmit().catch(() => undefined);
  };

  return (
    <form
      onSubmit={(e) => {
        // Tappable while saving (never disabled); a second tap must not resend over the first.
        if (isSubmitting) return e.preventDefault();
        void onSubmit(e).catch(() => undefined);
      }}
      className="flex flex-col gap-4"
    >
      {has(EDITOR_FIELD.HERO_PHOTOS) && (
        <div className="space-y-1">
          <p className="text-small text-muted-foreground">{SECTION_COPY.heroPhotosHelp}</p>
          <SlotPhotos
            orgId={orgId}
            slot={IMAGE_SLOT.STOREFRONT_HERO}
            label={SECTION_COPY.heroPhotosHelp}
            max={HERO_PHOTOS_MAX}
            value={(values.heroImages ?? []) as ImageSlotValue[]}
            onChange={(images) => setValue("heroImages", images, { shouldDirty: true })}
            error={errors.heroImages?.message}
          />
        </div>
      )}
      {has(EDITOR_FIELD.HERO_LINE) && (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="hero-line">{SECTION_COPY.heroLine}</Label>
            <span className="text-2xs">
              <Counter length={values.heroLine?.length ?? 0} max={HERO_LINE_MAX} />
            </span>
          </div>
          <Input id="hero-line" {...register("heroLine")} />
          {errors.heroLine?.message && <p className="text-sm text-destructive">{errors.heroLine.message}</p>}
        </div>
      )}
      {has(EDITOR_FIELD.COLLECTIONS) && (
        <CollectionsField
          orgId={orgId}
          options={settings.categoryOptions}
          value={(values.collections ?? []).map((c) => ({ categoryId: c.categoryId, photoUrl: c.photoUrl ?? null, image: (c.image ?? null) as ImageSlotValue | null }))}
          onChange={(collections) => setValue("collections", collections, { shouldDirty: true })}
          error={errors.collections?.message}
        />
      )}
      {has(EDITOR_FIELD.CLAIMS) && (
        <ClaimsField
          options={settings.claimOptions}
          value={(values.claims ?? []).map((c) => ({ key: c.key, detail: c.detail ?? null }))}
          onChange={(claims) => setValue("claims", claims, { shouldDirty: true })}
          error={errors.claims?.message}
        />
      )}
      {has(EDITOR_FIELD.OPENING_HOURS) && (
        <HoursField
          value={values.openingHours ?? null}
          onChange={(hours) => setValue("openingHours", hours, { shouldDirty: true })}
          error={errors.openingHours?.message ?? errors.openingHours?.open?.message ?? errors.openingHours?.close?.message}
        />
      )}
      {(section === SECTION.STORY || section === SECTION.VISIT) && (
        <p className="text-sm text-muted-foreground">
          {section === SECTION.STORY ? SECTION_COPY.storyHelp : SECTION_COPY.visitHelp}{" "}
          <Link prefetch={false} href={ROUTES.org.shopDetails(orgId)} className="underline underline-offset-4">
            {SECTION_COPY.shopDetails}
          </Link>
        </p>
      )}
      {isHideableSection(section) && (
        <HideField
          hidden={hidden}
          onChange={(hide) => {
            const rest = (values.storefrontHiddenSections ?? []).filter((s) => s !== section);
            setValue("storefrontHiddenSections", hide ? [...rest, section] : rest, { shouldDirty: true });
          }}
        />
      )}

      {formError && (
        <div role="alert" className="space-y-2 rounded-field bg-destructive/10 p-3 text-sm text-destructive">
          <p>{formError}</p>
          {stale ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={onLoadTheirs}>
                {SECTION_COPY.load}
              </Button>
              <Button type="button" className="min-h-11" onClick={() => void keepMine()}>
                {SECTION_COPY.keepMine}
              </Button>
            </div>
          ) : (
            <Button type="submit" variant="outline" className="min-h-11">
              {SECTION_COPY.tryAgain}
            </Button>
          )}
        </div>
      )}

      <Button type="submit" size="lg" className="min-h-11 w-full" pending={slow}>
        {slow ? SECTION_COPY.saving : SECTION_COPY.save}
      </Button>
    </form>
  );
}
