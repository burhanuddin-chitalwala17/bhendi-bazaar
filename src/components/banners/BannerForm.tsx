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
import { BANNER_FORM_COPY } from "./banner-copy";
import { ROUTES } from "@server/shared/routes";

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
    successMessage: BANNER_FORM_COPY.saved,
    submit: (data) => bannersApiClient.save(action, method, data),
    onSuccess: () => {
      router.push(ROUTES.admin.banners);
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
        label={BANNER_FORM_COPY.eyebrow}
        error={errors.eyebrow?.message}
        hint={BANNER_FORM_COPY.eyebrowHint}
      >
        <Input id={fieldId("eyebrow")} {...form.register("eyebrow")} placeholder={BANNER_FORM_COPY.eyebrowPlaceholder} />
      </FormField>

      <FormField
        id={fieldId("title")}
        label={BANNER_FORM_COPY.headline}
        error={errors.title?.message}
        hint={BANNER_FORM_COPY.headlineHint}
      >
        <Input
          id={fieldId("title")}
          {...form.register("title")}
          placeholder={BANNER_FORM_COPY.headlinePlaceholder}
        />
      </FormField>

      <FormField
        id={fieldId("description")}
        label={BANNER_FORM_COPY.description}
        error={errors.description?.message}
        hint={BANNER_FORM_COPY.descriptionHint}
      >
        <Textarea id={fieldId("description")} rows={3} {...form.register("description")} />
      </FormField>

      <ImageSlotField
        slot={IMAGE_SLOT.HOME_BANNER}
        label={BANNER_FORM_COPY.picture}
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
          label={BANNER_FORM_COPY.imageAlt}
          error={errors.imageAlt?.message}
          hint={BANNER_FORM_COPY.imageAltHint}
        >
          <Input id={fieldId("imageAlt")} {...form.register("imageAlt")} />
        </FormField>
      )}

      <fieldset className="space-y-3">
        <legend className="text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">
          {BANNER_FORM_COPY.buttons}
        </legend>
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="space-y-3 rounded-field border border-border p-3 sm:flex sm:items-end sm:gap-3 sm:space-y-0"
          >
            <FormField
              id={fieldId(`actions-${index}-label`)}
              label={BANNER_FORM_COPY.buttonLabel}
              required
              className="sm:flex-1"
              error={errors.actions?.[index]?.label?.message}
            >
              <Input
                id={fieldId(`actions-${index}-label`)}
                {...form.register(`actions.${index}.label`)}
                placeholder={BANNER_FORM_COPY.buttonLabelPlaceholder}
              />
            </FormField>
            <FormField
              id={fieldId(`actions-${index}-href`)}
              label={BANNER_FORM_COPY.destination}
              required
              className="sm:flex-1"
              error={errors.actions?.[index]?.href?.message}
            >
              <Input
                id={fieldId(`actions-${index}-href`)}
                {...form.register(`actions.${index}.href`)}
                placeholder={BANNER_FORM_COPY.destinationPlaceholder}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </FormField>
            <FormField id={fieldId(`actions-${index}-variant`)} label={BANNER_FORM_COPY.style} className="sm:w-40">
              <Select id={fieldId(`actions-${index}-variant`)} {...form.register(`actions.${index}.variant`)}>
                <option value="PRIMARY">{BANNER_FORM_COPY.styleFilled}</option>
                <option value="SECONDARY">{BANNER_FORM_COPY.styleOutlined}</option>
              </Select>
            </FormField>
            <Button
              type="button"
              variant="outline"
              shape="icon"
              aria-label={BANNER_FORM_COPY.removeButton(index + 1)}
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
            <Icon name="add" /> {BANNER_FORM_COPY.addButton}
          </Button>
        )}
        {errors.actions?.message && (
          <p className="text-caption text-destructive">{errors.actions.message}</p>
        )}
      </fieldset>

      <FormField
        id={fieldId("isActive")}
        label={BANNER_FORM_COPY.live}
        hint={BANNER_FORM_COPY.liveHint}
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
        onCancel={() => router.push(ROUTES.admin.banners)}
        isSubmitting={form.isSubmitting}
        submitLabel={BANNER_FORM_COPY.save}
      />
    </form>
  );
}
