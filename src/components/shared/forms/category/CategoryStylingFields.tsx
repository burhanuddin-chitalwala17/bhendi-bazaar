// components/shared/forms/category/CategoryStylingFields.tsx

import { UseFormRegister, UseFormWatch } from "react-hook-form";
import { FormSelect } from "../FormField";
import type { CreateCategoryInput } from "@/domain/admin";

interface CategoryStylingFieldsProps {
  register: UseFormRegister<CreateCategoryInput>;
  watch: UseFormWatch<CreateCategoryInput>;
}

// These literals are DATA, not styling: `Category.accentColorClass` rows in the
// database hold these exact strings, so the options must keep matching them — a
// tokenisation pass must NOT rewrite this list (it broke rows once). The defect is
// storing Tailwind classes in the DB at all; category-tree owns replacing them with
// a semantic key. Tracked in BACKLOG.
const ACCENT_COLORS = [
  { value: "bg-emerald-50", label: "Emerald" },
  { value: "bg-blue-50", label: "Blue" },
  { value: "bg-purple-50", label: "Purple" },
  { value: "bg-pink-50", label: "Pink" },
  { value: "bg-orange-50", label: "Orange" },
  { value: "bg-yellow-50", label: "Yellow" },
  { value: "bg-red-50", label: "Red" },
  { value: "bg-gray-50", label: "Gray" },
];

export function CategoryStylingFields({
  register,
  watch,
}: CategoryStylingFieldsProps) {
  const selectedColor = watch("accentColorClass");

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Styling</h2>
      <div className="space-y-4">
        <FormSelect
          label="Accent Color"
          required
          {...register("accentColorClass")}
        >
          {ACCENT_COLORS.map((color) => (
            <option key={color.value} value={color.value}>
              {color.label}
            </option>
          ))}
        </FormSelect>

        {/* Color Preview */}
        <div className="flex items-center gap-2">
          <div
            className={`w-12 h-12 rounded-lg border-2 border-border ${selectedColor}`}
          />
          <span className="text-sm text-muted-foreground">Preview</span>
        </div>
      </div>
    </div>
  );
}

