/**
 * Checkbox Component
 * Reusable checkbox with label
 */

import { forwardRef } from "react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = "", ...props }, ref) => {
    return (
      <div className="flex items-start">
        <input
          ref={ref}
          type="checkbox"
          className={`mt-1 h-4 w-4 text-primary border-input rounded focus:ring-ring ${className}`}
          {...props}
        />
        <div className="ml-3">
          <label className="text-sm font-medium text-foreground/80">{label}</label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

