"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormInput,
  FormSelect,
  FormTextarea,
} from "@/components/shared/forms/FormField";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import { ImageUpload } from "@/components/shared/image-upload";
import { useServerForm } from "@/hooks/core/useServerForm";
import { orgStorefrontApiClient } from "@/components/org/orgStorefrontApiClient";
import {
  STOREFRONT_ACCENTS,
  storefrontSettingsSchema,
  type StorefrontSettingsInput,
} from "@/lib/validation/schemas/storefront.schema";
import { HandleChangeDialog } from "@/components/org/handle-change-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  HIDEABLE_BRAND_PAGE_SECTIONS,
  MAX_BRAND_PILLARS,
  type HideableBrandPageSection,
} from "@server/catalog/brand-page-sections";
import { SOCIAL_NETWORKS, SOCIAL_NETWORK_KEYS } from "@server/catalog/social-networks";

export interface StorefrontSettings {
  handle: string;
  name: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  heroUrl: string | null;
  accent: string | null;
  deliveryPolicy: string | null;
  returnsPolicy: string | null;
  story: string | null;
  location: string | null;
  social: unknown;
  ownerName: string | null;
  ownerRole: string | null;
  ownerQuote: string | null;
  ownerPhotoUrl: string | null;
  pillars: unknown;
  hiddenSections: unknown;
}

/** What a shop calls each part it may switch off; the keys are for the code. */
const SECTION_LABELS: Record<HideableBrandPageSection, string> = {
  story: "About the shop",
  pillars: "How you work",
  brands: "Brands you carry",
  policies: "Delivery and returns",
  social: "Ways to follow you",
};

/** Three slots, always shown. An untouched one is not a block and is dropped on save. */
const PILLAR_SLOTS = Array.from({ length: MAX_BRAND_PILLARS }, (_, index) => index);

/** The stored JSON is read back defensively here too — the column is whatever was last written. */
function storedPillars(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return PILLAR_SLOTS.map((index) => {
    const row = rows[index];
    const entry = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
    return {
      title: typeof entry.title === "string" ? entry.title : "",
      text: typeof entry.text === "string" ? entry.text : "",
    };
  });
}

function storedHandles(value: unknown): Record<string, string> {
  const social = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    SOCIAL_NETWORK_KEYS.map((network) => [
      network,
      typeof social[network] === "string" ? (social[network] as string) : "",
    ]),
  );
}

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
 * reasoning applied to content). The accent is a token name picked from a fixed list,
 * never a colour value (ADR-0022).
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
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [heroUrl, setHeroUrl] = useState(settings.heroUrl ?? "");
  const [ownerPhotoUrl, setOwnerPhotoUrl] = useState(settings.ownerPhotoUrl ?? "");

  const {
    register,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<StorefrontSettingsInput>({
    schema: storefrontSettingsSchema,
    defaultValues: {
      tagline: settings.tagline ?? "",
      description: settings.description ?? "",
      accent: (settings.accent ?? "") as StorefrontSettingsInput["accent"],
      deliveryPolicy: settings.deliveryPolicy ?? "",
      returnsPolicy: settings.returnsPolicy ?? "",
      story: settings.story ?? "",
      location: settings.location ?? "",
      social: storedHandles(settings.social),
      ownerName: settings.ownerName ?? "",
      ownerRole: settings.ownerRole ?? "",
      ownerQuote: settings.ownerQuote ?? "",
      pillars: storedPillars(settings.pillars),
      hiddenSections: storedHidden(settings.hiddenSections),
    },
    successMessage: "Storefront saved.",
    // The images are managed outside the form's state by ImageUpload, so they are
    // merged in here rather than registered as fields.
    submit: (data) => orgStorefrontApiClient.saveSettings(orgId, { ...data, logoUrl, heroUrl, ownerPhotoUrl }),
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
          Everything below is saved together by the button at the end.
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
              label="Logo"
              value={logoUrl ? [logoUrl] : []}
              onChange={(urls) => setLogoUrl(urls[0] ?? "")}
              maxImages={1}
              endpoint={`/api/org/${orgId}/upload`}
            />

            <ImageUpload
              label="Cover image — the picture at the top of your About page"
              value={heroUrl ? [heroUrl] : []}
              onChange={(urls) => setHeroUrl(urls[0] ?? "")}
              maxImages={1}
              endpoint={`/api/org/${orgId}/upload`}
            />

            <FormInput
              label="Tagline"
              placeholder="A line about what you sell"
              {...register("tagline")}
              error={errors.tagline?.message}
            />

            <FormSelect
              label="Accent"
              {...register("accent")}
              error={errors.accent?.message}
            >
              <option value="">Default</option>
              {STOREFRONT_ACCENTS.map((accent) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </FormSelect>
          </CardContent>
        </Card>

        <Card id="about">
          <CardHeader>
            <CardTitle>About your shop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormTextarea
              label="Introduction"
              rows={6}
              placeholder="Who you are, what you make, how long you have been doing it."
              {...register("description")}
              error={errors.description?.message}
            />
            <FormTextarea
              label="The longer story"
              rows={5}
              placeholder="How the shop started, what changed, what you are known for."
              {...register("story")}
              error={errors.story?.message}
            />
            <FormInput
              label="Where you are"
              placeholder="Bhendi Bazaar, Mumbai"
              {...register("location")}
              error={errors.location?.message}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>The person behind the shop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-2xs text-muted-foreground">
              Optional, and shown with your story. A buyer trusts a name more than a
              paragraph. Leave it blank and the story stands on its own.
            </p>
            <FormInput
              label="Name"
              placeholder="Who a buyer would be dealing with"
              {...register("ownerName")}
              error={errors.ownerName?.message}
            />
            <FormInput
              label="What they do here"
              placeholder="Owner, second generation, head tailor"
              {...register("ownerRole")}
              error={errors.ownerRole?.message}
            />
            <FormTextarea
              label="One line worth quoting"
              rows={3}
              placeholder="Something they would actually say to a customer."
              {...register("ownerQuote")}
              error={errors.ownerQuote?.message}
            />
            <ImageUpload
              label="Photograph"
              value={ownerPhotoUrl ? [ownerPhotoUrl] : []}
              onChange={(urls) => setOwnerPhotoUrl(urls[0] ?? "")}
              maxImages={1}
              endpoint={`/api/org/${orgId}/upload`}
            />
          </CardContent>
        </Card>

        <Card id="pillars">
          <CardHeader>
            <CardTitle>How you work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-2xs text-muted-foreground">
              Up to three short blocks on how or why you do things. Fill in both the
              heading and the line, or leave the pair blank.
            </p>
            {PILLAR_SLOTS.map((index) => (
              <div key={index} className="space-y-3 rounded-card border border-border/60 p-3">
                <FormInput
                  label={`Block ${index + 1} heading`}
                  placeholder="Woven near by"
                  {...register(`pillars.${index}.title` as const)}
                  error={errors.pillars?.[index]?.title?.message}
                />
                <FormTextarea
                  label={`Block ${index + 1} line`}
                  rows={3}
                  placeholder="Every metre comes from three looms we visit ourselves."
                  {...register(`pillars.${index}.text` as const)}
                  error={errors.pillars?.[index]?.text?.message}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card id="social">
          <CardHeader>
            <CardTitle>Ways to follow you</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-2xs text-muted-foreground">
              Your handle on each network, not a web address. We build the link, so a
              buyer always lands where they expect.
            </p>
            {SOCIAL_NETWORK_KEYS.map((network) => (
              <FormInput
                key={network}
                label={SOCIAL_NETWORKS[network].label}
                placeholder="yourhandle"
                {...register(`social.${network}` as const)}
                error={errors.social?.[network]?.message}
              />
            ))}
          </CardContent>
        </Card>

        <Card id="policies">
          <CardHeader>
            <CardTitle>Your terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* R3a: unambiguous whose promise this is. */}
            <p className="text-2xs text-muted-foreground">
              Delivery and returns are yours to set. Payment and fraud
              protection stay Bhendi Bazaar&apos;s, and cannot be signed away
              here. Leave a field blank and the platform&apos;s own terms stand
              in.
            </p>
            <FormTextarea
              label="Delivery"
              rows={4}
              {...register("deliveryPolicy")}
              error={errors.deliveryPolicy?.message}
            />
            <FormTextarea
              label="Returns"
              rows={4}
              {...register("returnsPolicy")}
              error={errors.returnsPolicy?.message}
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
