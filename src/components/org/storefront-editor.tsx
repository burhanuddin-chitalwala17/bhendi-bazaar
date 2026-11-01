"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import { ImageUpload } from "@/components/shared/image-upload";
import { useServerForm } from "@/hooks/core/useServerForm";
import { orgStorefrontApiClient } from "@/components/org/orgStorefrontApiClient";
import {
  storefrontSettingsSchema,
  type StorefrontSettingsInput,
} from "@/lib/validation/schemas/storefront.schema";
import { HandleChangeDialog } from "@/components/org/handle-change-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HIDEABLE_BRAND_PAGE_SECTIONS,
  type HideableBrandPageSection,
} from "@server/catalog/brand-page-sections";

export interface StorefrontSettings {
  handle: string;
  name: string;
  heroUrl: string | null;
  hiddenSections: unknown;
  /** The version read, which the save compares-and-sets on (storefront-themes D13). */
  updatedAt: string;
}

/** What a shop calls each part it may switch off; the keys are for the code. */
const SECTION_LABELS: Record<HideableBrandPageSection, string> = {
  story: "About the shop",
  brands: "Brands you carry",
  policies: "Delivery and returns",
  social: "Ways to follow you",
};

function storedHidden(value: unknown): HideableBrandPageSection[] {
  const keys: readonly string[] = HIDEABLE_BRAND_PAGE_SECTIONS;
  return Array.isArray(value)
    ? (value.filter((key): key is HideableBrandPageSection => typeof key === "string" && keys.includes(key)))
    : [];
}

/**
 * Where an org composes its own shop (storefront-branding R1, R11).
 *
 * Fields, not a page builder: an org fills in what a shop has and cannot arrange
 * blocks, so nothing it supplies can break the layout on any screen (R6, ADR-0031's
 * reasoning applied to content). The accent is retired (storefront-themes D13): a theme's
 * palettes replace it, and an unthemed page still reads what is stored.
 *
 * Single column throughout, which is the phone layout and also fine on a desktop for a
 * form this short — an org running a shop from a phone has to be able to run its
 * storefront from one (R11).
 */
export function StorefrontEditor({
  orgId,
  settings,
  oldAddressWorksUntil,
}: {
  orgId: string;
  settings: StorefrontSettings;
  oldAddressWorksUntil: string;
}) {
  const router = useRouter();
  const [heroUrl, setHeroUrl] = useState(settings.heroUrl ?? "");

  const {
    register,
    reset,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<StorefrontSettingsInput>({
    schema: storefrontSettingsSchema,
    defaultValues: {
      expectedUpdatedAt: settings.updatedAt,
      hiddenSections: storedHidden(settings.hiddenSections),
    },
    successMessage: "Storefront saved.",
    // The cover is managed outside the form's state by ImageUpload, so it is merged in here.
    submit: async (data) => {
      const saved = await orgStorefrontApiClient.saveSettings(orgId, { ...data, heroUrl });
      // The form keeps its first defaults across a refresh, so the next save must carry this version.
      reset({ ...data, expectedUpdatedAt: saved.updatedAt });
      return saved;
    },
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This is the link you share. It works on a card, in a message, or in
            an advertisement.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-field bg-muted px-2 py-1 text-sm">
              /store/{settings.handle}
            </code>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/store/${settings.handle}`} target="_blank">
                <ExternalLink />
                Open
              </Link>
            </Button>
            <HandleChangeDialog
              orgId={orgId}
              currentHandle={settings.handle}
              oldAddressWorksUntil={oldAddressWorksUntil}
            />
          </div>
        </CardContent>
      </Card>

      <form onSubmit={onSubmit} className="space-y-6">
        <p className="text-2xs text-muted-foreground">
          Everything below is saved together by the button at the end. Your logo, the line about
          your shop and everything buyers read about you are on{" "}
          <Link href={`/org/${orgId}/shop/details`} className="underline">Shop details</Link>.
        </p>
        {formError && (
          <p className="rounded-field bg-destructive/10 p-3 text-sm text-destructive">
            {formError}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your shop&apos;s look</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ImageUpload
              label="Cover image — the picture at the top of your About page"
              value={heroUrl ? [heroUrl] : []}
              onChange={(urls) => setHeroUrl(urls[0] ?? "")}
              maxImages={1}
              endpoint={`/api/org/${orgId}/upload`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What to leave out</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xs text-muted-foreground">
              Anything you have written is yours to withhold. What buyers said, what you
              have sold and the goods themselves are not switched off here — those are
              their account of you, not your claim about yourself.
            </p>
            {HIDEABLE_BRAND_PAGE_SECTIONS.map((section) => (
              <Checkbox
                key={section}
                label={`Hide “${SECTION_LABELS[section]}”`}
                value={section}
                {...register("hiddenSections")}
              />
            ))}
            {/* One message for the group: the boxes carry the only values the set allows, so
                a failure here means a payload nobody could have produced by clicking. */}
            {errors.hiddenSections?.message && (
              <p className="text-sm text-destructive">{errors.hiddenSections.message}</p>
            )}
          </CardContent>
        </Card>

        <FormActions
          isSubmitting={isSubmitting}
          submitLabel="Save storefront"
          onCancel={() => router.refresh()}
        />
      </form>
    </div>
  );
}
