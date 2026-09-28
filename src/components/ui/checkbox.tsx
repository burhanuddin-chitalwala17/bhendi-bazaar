/**
 * A checkbox and the words that say what it does.
 *
 * The two are associated by id, so the words are part of the control rather than text
 * sitting beside it: the row is the target, which is the only way a 16px box is usable on a
 * phone ([ADR-0015](../../../docs/adr/0015-mobile-first-design.md) — targets are at least
 * 40px, and a label nobody can tap is how a box that small ships looking fine).
 */

import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = "", id, ...props }, ref) => {
    const generated = useId();
    const inputId = id ?? generated;

    return (
      <div className="flex items-start">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn(
            "mt-3 size-4 shrink-0 rounded border-input text-primary focus:ring-ring",
            className,
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className="ml-3 flex min-h-10 cursor-pointer flex-col justify-center py-2"
        >
          <span className="text-sm font-medium text-foreground/80">{label}</span>
          {description && (
            <span className="mt-0.5 text-xs text-muted-foreground">{description}</span>
          )}
        </label>
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";
