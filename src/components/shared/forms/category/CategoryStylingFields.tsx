// components/shared/forms/category/CategoryStylingFields.tsx

import { UseFormRegister, UseFormWatch } from "react-hook-form";
import { FormSelect } from "../FormField";
import type { CreateCategoryInput } from "@/domain/admin";
import { CATEGORY_ACCENTS, CATEGORY_ACCENT_KEYS } from "@/lib/category-accent";
import { CATEGORY_STYLING_FIELDS_COPY } from "./category-copy";

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
      <h2 className="text-title font-semibold text-foreground mb-4">{CATEGORY_STYLING_FIELDS_COPY.styling}</h2>
      <div className="space-y-4">
        <FormSelect label={CATEGORY_STYLING_FIELDS_COPY.accentColor} required {...register("accent")}>
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
          <span className="text-small text-muted-foreground">{CATEGORY_STYLING_FIELDS_COPY.preview}</span>
        </div>
      </div>
    </div>
  );
}
