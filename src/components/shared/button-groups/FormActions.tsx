// components/shared/button-groups/FormActions.tsx

import { Button } from "@/components/ui/button";

interface FormActionsProps {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function FormActions({
  onCancel,
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  isSubmitting = false,
  disabled = false,
}: FormActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isSubmitting || disabled}
        onClick={onCancel}
        className="h-10 rounded-full text-2xs font-semibold uppercase tracking-eyebrow sm:h-8"
      >
        {cancelLabel}
      </Button>
      <Button
        type={onSubmit ? "button" : "submit"}
        size="sm"
        disabled={isSubmitting || disabled}
        onClick={onSubmit}
        className="h-10 rounded-full text-2xs font-semibold uppercase tracking-eyebrow sm:h-8"
      >
        {isSubmitting ? "Saving…" : submitLabel}
      </Button>
    </div>
  );
}