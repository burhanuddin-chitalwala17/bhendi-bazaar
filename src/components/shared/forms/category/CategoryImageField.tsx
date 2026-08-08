import { Control, FieldErrors } from "react-hook-form";
import { FormController } from "../FormField";
import { ImageUpload } from "@/admin/image-upload";
import type { CreateCategoryInput } from "@/domain/admin";

interface CategoryImageFieldProps {
  control: Control<CreateCategoryInput>;
  errors: FieldErrors<CreateCategoryInput>;
}

export function CategoryImageField({
  control,
  errors,
}: CategoryImageFieldProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Hero Image</h2>
      <FormController
        name="heroImage"
        control={control}
        label="Category Hero Image"
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
      <p className="text-sm text-muted-foreground mt-2">
        This image will be displayed on the category page header. Recommended
        size: 1920x600px
      </p>
    </div>
  );
}

