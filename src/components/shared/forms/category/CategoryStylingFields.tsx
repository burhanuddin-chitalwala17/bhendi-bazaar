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
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Styling</h2>
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
            className={`w-12 h-12 rounded-lg border-2 border-border ${accent?.swatch ?? ""}`}
          />
          <span className="text-sm text-muted-foreground">Preview</span>
        </div>
      </div>
    </div>
  );
}
