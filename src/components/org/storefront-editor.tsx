"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared/forms/FormField";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import { ImageUpload } from "@/components/shared/image-upload";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
import {
  STOREFRONT_ACCENTS,
  storefrontSettingsSchema,
  type StorefrontSettingsInput,
} from "@/lib/validation/schemas/storefront.schema";
import { HandleChangeDialog } from "@/components/org/handle-change-dialog";

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
    },
    successMessage: "Storefront saved.",
    submit: async (data) => {
      const response = await fetch(`/api/org/${orgId}/storefront`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // The images are managed outside the form's state by ImageUpload, so they are
        // merged in here rather than registered as fields.
        body: JSON.stringify({ ...data, logoUrl, heroUrl }),
      });
      if (!response.ok) throw await readApiError(response);
      router.refresh();
      return response.json();
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This is the link you share. It works on a card, in a message, or in an
            advertisement.
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

        <Card>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* R3a: unambiguous whose promise this is. */}
            <p className="text-2xs text-muted-foreground">
              Delivery and returns are yours to set. Payment and fraud protection stay
              Bhendi Bazaar&apos;s, and cannot be signed away here. Leave a field blank
              and the platform&apos;s own terms stand in.
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

        <FormActions
          isSubmitting={isSubmitting}
          submitLabel="Save storefront"
          onCancel={() => router.refresh()}
        />
      </form>
    </div>
  );
}
