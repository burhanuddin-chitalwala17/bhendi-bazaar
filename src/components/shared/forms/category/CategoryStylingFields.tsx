// components/shared/forms/category/CategoryStylingFields.tsx

import { UseFormRegister, UseFormWatch } from "react-hook-form";
import { FormSelect } from "../FormField";
import type { CreateCategoryInput } from "@/domain/admin";
import { CATEGORY_ACCENTS, CATEGORY_ACCENT_KEYS } from "@/lib/category-accent";

interface CategoryStylingFieldsProps {
  register: UseFormRegister<CreateCategoryInput>;
  watch: UseFormWatch<CreateCategoryInput>;
}

export function CategoryStylingFields({
  register,
  watch,
}: CategoryStylingFieldsProps) {
  const selected = watch("accent");
  const accent = selected ? CATEGORY_ACCENTS[selected] : undefined;

  return (
    <div className="rounded-card border border-border bg-card p-6">
      <h2 className="text-title font-semibold text-foreground mb-4">Styling</h2>
      <div className="space-y-4">
        <FormSelect label="Accent Color" required {...register("accent")}>
          {CATEGORY_ACCENT_KEYS.map((key) => (
            <option key={key} value={key}>
              {CATEGORY_ACCENTS[key].label}
            </option>
          ))}
        </FormSelect>

        {/* Color Preview */}
        <div className="flex items-center gap-2">
          <div
            className={`size-12 rounded-field border-2 border-border ${accent?.swatch ?? ""}`}
          />
          <span className="text-small text-muted-foreground">Preview</span>
        </div>
      </div>
    </div>
  );
}
