/**
 * Select Component
 * Reusable select dropdown
 */

import { forwardRef } from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <div>
        <select
          ref={ref}
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring ${
            error ? "border-destructive" : "border-input"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-destructive text-sm mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

