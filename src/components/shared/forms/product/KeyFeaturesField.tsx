"use client";

import { Icon } from "@/components/ui/icon";

import { Button } from "@/components/ui/button";
import { FormInput } from "../FormField";
import type { ProductForm } from "./ProductSections";
import { KEY_FEATURES_FIELD_COPY } from "./product-copy";
import { KEY_FEATURES_ADD_COPY } from "@/components/shared/forms/product/product-copy";

const MAX_FEATURES = 5;

/** Up to five short points a marketplace shows first (channel-listings Q6). */
export function KeyFeaturesField({ form }: { form: ProductForm }) {
  const { register, watch, setValue, formState } = form;
  const features = watch("keyFeatures") ?? [];
  const errors = formState.errors.keyFeatures;
  const set = (next: string[]) => setValue("keyFeatures", next, { shouldDirty: true, shouldValidate: false });

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{KEY_FEATURES_FIELD_COPY.keyFeatures}</legend>
      <p className="text-xs text-muted-foreground">{KEY_FEATURES_FIELD_COPY.upToFiveShortPoints}</p>
      {features.map((_, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <FormInput
              aria-label={`Key feature ${index + 1}`}
              placeholder={KEY_FEATURES_FIELD_COPY.eGSoftNidaFalls}
              {...register(`keyFeatures.${index}` as const)}
              error={Array.isArray(errors) ? errors[index]?.message : undefined}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            shape="icon"
            className="min-h-10 min-w-10"
            aria-label={`Remove key feature ${index + 1}`}
            onClick={() => set(features.filter((__, i) => i !== index))}
          >
            <Icon name="close" />
          </Button>
        </div>
      ))}
      {!Array.isArray(errors) && errors?.message && <p className="text-xs text-destructive">{errors.message}</p>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-10 self-start"
        onClick={() => (features.length < MAX_FEATURES ? set([...features, ""]) : undefined)}
      >
        <Icon name="add" /> {features.length < MAX_FEATURES ? KEY_FEATURES_ADD_COPY.add : KEY_FEATURES_ADD_COPY.full}
      </Button>
    </fieldset>
  );
}
