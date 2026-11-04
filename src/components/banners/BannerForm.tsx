"use client";

import { useId } from "react";
import { useFieldArray } from "react-hook-form";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/shared/forms/FormField";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  bannerFormSchema,
  type BannerFormSchemaInput,
} from "@/lib/validation/schemas/banner.schema";
import { ImageSlotField } from "@/components/shared/image-slot/image-slot-field";
import { uploadApiClient } from "@/components/shared/uploadApiClient";
import { IMAGE_SLOT } from "@server/catalog/image-slots";
import { bannersApiClient } from "./bannersApiClient";

const EMPTY: BannerFormSchemaInput = {
  title: null,
  eyebrow: null,
  description: null,
  image: null,
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
    submit: (data) => bannersApiClient.save(action, method, data),
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
  const image = form.watch("image");
  // One prefix, so each label can point at the control it names.
  const id = useId();
  const fieldId = (name: string) => `${id}-${name}`;

  return (
    <form onSubmit={form.onSubmit} className="space-y-5">
      {form.formError && (
        <p className="rounded-field border border-destructive/30 bg-destructive/10 px-4 py-3 text-small text-destructive">
          {form.formError}
        </p>
      )}

      <FormField
        id={fieldId("eyebrow")}
        label="Eyebrow"
        error={errors.eyebrow?.message}
        hint="The small line above the headline."
      >
        <Input id={fieldId("eyebrow")} {...form.register("eyebrow")} placeholder="The Abaya Edit" />
      </FormField>

      <FormField
        id={fieldId("title")}
        label="Headline"
        error={errors.title?.message}
        hint="Leave it blank for artwork that already carries its own words — the banner then shows the picture alone, with no shading over it."
      >
        <Input
          id={fieldId("title")}
          {...form.register("title")}
          placeholder="Cut for the everyday…"
        />
      </FormField>

      <FormField
        id={fieldId("description")}
        label="Description"
        error={errors.description?.message}
        hint="Two lines on a phone, three on desktop — anything longer is clipped."
      >
        <Textarea id={fieldId("description")} rows={3} {...form.register("description")} />
      </FormField>

      <ImageSlotField
        slot={IMAGE_SLOT.HOME_BANNER}
        label="Background picture"
        value={image ?? null}
        onChange={(next) => form.setValue("image", next, { shouldDirty: true })}
        upload={async (file) => {
          const [url] = await uploadApiClient.uploadFiles("/api/admin/upload", "banners", [file], { identifier: "banner" });
          return url;
        }}
        error={errors.image?.message}
      />

      {image && (
        <FormField
          id={fieldId("imageAlt")}
          label="Image description"
          error={errors.imageAlt?.message}
          hint="What the picture shows, for a shopper using a screen reader."
        >
          <Input id={fieldId("imageAlt")} {...form.register("imageAlt")} />
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
              id={fieldId(`actions-${index}-label`)}
              label="Label"
              required
              className="sm:flex-1"
              error={errors.actions?.[index]?.label?.message}
            >
              <Input
                id={fieldId(`actions-${index}-label`)}
                {...form.register(`actions.${index}.label`)}
                placeholder="Shop Abayas"
              />
            </FormField>
            <FormField
              id={fieldId(`actions-${index}-href`)}
              label="Destination"
              required
              className="sm:flex-1"
              error={errors.actions?.[index]?.href?.message}
            >
              <Input
                id={fieldId(`actions-${index}-href`)}
                {...form.register(`actions.${index}.href`)}
                // What an admin will actually paste. Stored as the path, so the origin
                // in this example never reaches the database.
                placeholder="https://bhendi-bazaar.com/category/abayas"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </FormField>
            <FormField id={fieldId(`actions-${index}-variant`)} label="Style" className="sm:w-40">
              <Select id={fieldId(`actions-${index}-variant`)} {...form.register(`actions.${index}.variant`)}>
                <option value="PRIMARY">Filled</option>
                <option value="SECONDARY">Outlined</option>
              </Select>
            </FormField>
            <Button
              type="button"
              variant="outline"
              shape="icon"
              aria-label={`Remove button ${index + 1}`}
              onClick={() => remove(index)}
              className="h-10 w-full sm:h-9 sm:w-9"
            >
              <Icon name="delete" />
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
            <Icon name="add" /> Add button
          </Button>
        )}
        {errors.actions?.message && (
          <p className="text-caption text-destructive">{errors.actions.message}</p>
        )}
      </fieldset>

      <FormField
        id={fieldId("isActive")}
        label="Live on the storefront"
        hint="Turn off to take it down without losing it."
      >
        <Switch
          id={fieldId("isActive")}
          checked={form.watch("isActive")}
          onCheckedChange={(on) =>
            form.setValue("isActive", on, { shouldDirty: true })
          }
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
