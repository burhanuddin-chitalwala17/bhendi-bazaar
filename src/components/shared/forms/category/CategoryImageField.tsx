import { Control, FieldErrors } from "react-hook-form";
import { FormController } from "../FormField";
import { ImageUpload } from "@/components/shared/image-upload";
import type { CreateCategoryInput } from "@/domain/admin";
import { CATEGORY_IMAGE_FIELD_COPY } from "./category-copy";

interface CategoryImageFieldProps {
  control: Control<CreateCategoryInput>;
  errors: FieldErrors<CreateCategoryInput>;
}

export function CategoryImageField({
  control,
  errors,
}: CategoryImageFieldProps) {
  return (
    <div className="rounded-card border border-border bg-card p-6">
      <h2 className="text-title font-semibold text-foreground mb-4">{CATEGORY_IMAGE_FIELD_COPY.heroImage}</h2>
      <FormController
        name="heroImage"
        control={control}
        label={CATEGORY_IMAGE_FIELD_COPY.categoryHeroImage}
        required
        error={errors.heroImage?.message}
        render={(field) => (
          <ImageUpload
            label=""
            value={field.field.value ? [String(field.field.value)] : []}
            onChange={(urls) => field.field.onChange(urls[0] || "")}
            maxImages={1}
            required
            uploadType="categories"
          />
        )}
      />
      <p className="text-small text-muted-foreground mt-2">
        {CATEGORY_IMAGE_FIELD_COPY.thisImageWillBeDisplayed}
      </p>
    </div>
  );
}
