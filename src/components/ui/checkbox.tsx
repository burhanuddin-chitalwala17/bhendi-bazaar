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
  /** The words are spoken but not shown, for a box whose row already says what it picks. */
  hideLabel?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, hideLabel = false, className = "", id, ...props }, ref) => {
    const generated = useId();
    const inputId = id ?? generated;

    return (
      <div className={cn("flex items-start", hideLabel && "relative")}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn(
            "size-4 shrink-0 rounded border-input text-primary focus:ring-ring",
            !hideLabel && "mt-3",
            className,
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "flex min-h-10 cursor-pointer flex-col justify-center py-2",
            // Hidden words still leave a 40px target around the 16px box (ADR-0015).
            hideLabel ? "absolute -inset-3 min-h-0 py-0" : "ml-3",
          )}
        >
          <span className={hideLabel ? "sr-only" : "text-sm font-medium text-foreground/80"}>{label}</span>
          {description && (
            <span className="mt-0.5 text-xs text-muted-foreground">{description}</span>
          )}
        </label>
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";
