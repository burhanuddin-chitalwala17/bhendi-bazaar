"use client";

import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormController, FormInput } from "@/components/shared/forms/FormField";
import { CountryPicker } from "@/components/shared/forms/CountryPicker";
import { asCountryCode } from "@server/shared/countries";
import { useServerForm } from "@/hooks/core/useServerForm";
import { orgListingDefaultsApiClient } from "@/components/org/orgListingDefaultsApiClient";
import {
  listingDefaultsSchema,
  type ListingDefaultsParsed,
} from "@/lib/validation/schemas/listing-defaults.schema";
import type { OrgListingDefaultsDto } from "@server/catalog/org-listing-defaults.types";

interface ListingDefaultsFormProps {
  orgId: string;
  defaults: OrgListingDefaultsDto;
  /** The categories the org has products in — the rows of the tax-code list. */
  categories: Array<{ id: string; name: string }>;
}

/**
 * Org-wide listing defaults (org-profile spec R4): what a product starts from when neither it
 * nor its brand says otherwise. Defaults pre-fill and never validate, so every field here may
 * stay blank and the form still saves.
 */
export function ListingDefaultsForm({ orgId, defaults, categories }: ListingDefaultsFormProps) {
  const router = useRouter();
  const {
    register,
    control,
    onSubmit: handleFormSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<ListingDefaultsParsed>({
    schema: listingDefaultsSchema,
    submit: (data) => orgListingDefaultsApiClient.save(orgId, data),
    successMessage: "Defaults saved",
    onSuccess: () => router.refresh(),
    defaultValues: {
      countryOfOrigin: asCountryCode(defaults.countryOfOrigin),
      taxRatePercent: defaults.taxRatePercent ?? undefined,
      taxCodes: categories.map((category) => ({
        categoryId: category.id,
        taxCode: defaults.taxCodes.find((entry) => entry.categoryId === category.id)?.taxCode ?? "",
      })),
    },
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <FormController
        name="countryOfOrigin"
        control={control}
        label="Country of origin"
        hint="Where your products are made, unless a brand or a product says otherwise"
        error={errors.countryOfOrigin?.message}
        render={({ field }) => (
          <CountryPicker value={typeof field.value === "string" ? field.value : null} onChange={field.onChange} />
        )}
      />
      <FormInput
        label="Tax rate (%)"
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        max={100}
        placeholder="e.g. 18"
        {...register("taxRatePercent", { valueAsNumber: true })}
        error={errors.taxRatePercent?.message}
        hint="The GST rate most of your products carry"
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Tax code by category</legend>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Categories appear here once you have products in them.
          </p>
        ) : (
          categories.map((category, index) => (
            <div key={category.id}>
              <input type="hidden" {...register(`taxCodes.${index}.categoryId` as const)} />
              <FormInput
                label={category.name}
                placeholder="HSN code"
                {...register(`taxCodes.${index}.taxCode` as const)}
                error={errors.taxCodes?.[index]?.taxCode?.message}
              />
            </div>
          ))
        )}
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save defaults"}
        </Button>
      </div>
    </form>
  );
}
