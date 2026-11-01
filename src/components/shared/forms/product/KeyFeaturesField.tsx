"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormInput } from "../FormField";
import type { ProductForm } from "./ProductSections";

const MAX_FEATURES = 5;

/** Up to five short points a marketplace shows first (channel-listings Q6). */
export function KeyFeaturesField({ form }: { form: ProductForm }) {
  const { register, watch, setValue, formState } = form;
  const features = watch("keyFeatures") ?? [];
  const errors = formState.errors.keyFeatures;
  const set = (next: string[]) => setValue("keyFeatures", next, { shouldDirty: true, shouldValidate: false });

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Key features</legend>
      <p className="text-xs text-muted-foreground">Up to five short points buyers see first</p>
      {features.map((_, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <FormInput
              aria-label={`Key feature ${index + 1}`}
              placeholder="e.g., Soft Nida, falls without clinging"
              {...register(`keyFeatures.${index}` as const)}
              error={Array.isArray(errors) ? errors[index]?.message : undefined}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-10 min-w-10"
            aria-label={`Remove key feature ${index + 1}`}
            onClick={() => set(features.filter((__, i) => i !== index))}
          >
            <X aria-hidden />
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
        <Plus aria-hidden /> {features.length < MAX_FEATURES ? "Add a point" : "Five is the most a marketplace shows"}
      </Button>
    </fieldset>
  );
}
