"use client";

import { useFieldArray } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/shared/forms/FormField";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
import {
  bannerFormSchema,
  type BannerFormSchemaInput,
} from "@/lib/validation/schemas/banner.schema";
import { BannerImageField } from "./BannerImageField";

const EMPTY: BannerFormSchemaInput = {
  title: "",
  eyebrow: null,
  description: null,
  imageUrl: null,
  imageAlt: null,
  isActive: true,
  actions: [],
};

export function BannerForm({
  initial,
  action,
  method = "POST",
}: {
  initial?: BannerFormSchemaInput;
  action: string;
  method?: "POST" | "PATCH";
}) {
  const router = useRouter();

  const form = useServerForm<BannerFormSchemaInput>({
    schema: bannerFormSchema,
    defaultValues: initial ?? EMPTY,
    successMessage: "Banner saved",
    submit: async (data) => {
      const response = await fetch(action, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw await readApiError(response);
      return response.json();
    },
    onSuccess: () => {
      router.push("/admin/banners");
      router.refresh();
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "actions",
  });

  const errors = form.formState.errors;
  const imageUrl = form.watch("imageUrl");

  return (
    <form onSubmit={form.onSubmit} className="space-y-5">
      {form.formError && (
        <p className="rounded-field border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {form.formError}
        </p>
      )}

      <FormField label="Eyebrow" error={errors.eyebrow?.message} hint="The small line above the headline.">
        <Input {...form.register("eyebrow")} placeholder="The Abaya Edit" />
      </FormField>

      <FormField label="Headline" required error={errors.title?.message}>
        <Input {...form.register("title")} placeholder="Cut for the everyday…" />
      </FormField>

      <FormField
        label="Description"
        error={errors.description?.message}
        hint="Two lines on a phone, three on desktop — anything longer is clipped."
      >
        <Textarea rows={3} {...form.register("description")} />
      </FormField>

      <BannerImageField
        value={imageUrl ?? null}
        onChange={(url) => form.setValue("imageUrl", url, { shouldDirty: true })}
        disabled={form.isSubmitting}
      />

      {imageUrl && (
        <FormField
          label="Image description"
          error={errors.imageAlt?.message}
          hint="What the picture shows, for a shopper using a screen reader."
        >
          <Input {...form.register("imageAlt")} />
        </FormField>
      )}

      <fieldset className="space-y-3">
        <legend className="text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">
          Buttons
        </legend>
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="space-y-3 rounded-field border border-border p-3 sm:flex sm:items-end sm:gap-3 sm:space-y-0"
          >
            <FormField
              label="Label"
              required
              className="sm:flex-1"
              error={errors.actions?.[index]?.label?.message}
            >
              <Input {...form.register(`actions.${index}.label`)} placeholder="Shop Abayas" />
            </FormField>
            <FormField
              label="Destination"
              required
              className="sm:flex-1"
              error={errors.actions?.[index]?.href?.message}
            >
              <Input {...form.register(`actions.${index}.href`)} placeholder="/category/abayas" />
            </FormField>
            <FormField label="Style" className="sm:w-40">
              <Select {...form.register(`actions.${index}.variant`)}>
                <option value="PRIMARY">Filled</option>
                <option value="SECONDARY">Outlined</option>
              </Select>
            </FormField>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Remove button ${index + 1}`}
              onClick={() => remove(index)}
              className="h-10 w-full sm:h-9 sm:w-9"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {fields.length < 2 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ label: "", href: "", variant: "PRIMARY" })}
            className="h-10 w-full rounded-full text-2xs font-semibold uppercase tracking-eyebrow sm:w-auto"
          >
            <Plus /> Add button
          </Button>
        )}
        {errors.actions?.message && (
          <p className="text-xs text-destructive">{errors.actions.message}</p>
        )}
      </fieldset>

      <FormField label="Live on the storefront" hint="Turn off to take it down without losing it.">
        <Switch
          checked={form.watch("isActive")}
          onCheckedChange={(on) => form.setValue("isActive", on, { shouldDirty: true })}
        />
      </FormField>

      <FormActions
        onCancel={() => router.push("/admin/banners")}
        isSubmitting={form.isSubmitting}
        submitLabel="Save banner"
      />
    </form>
  );
}
