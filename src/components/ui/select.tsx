import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import { Icon } from "./icon";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

/**
 * A native select, so a phone opens its own picker. The browser's arrow is hidden and ours drawn
 * instead: each engine puts its own at a different inset, flush against the border in some.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, error, ...props }, ref) => {
  return (
    <div>
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full appearance-none rounded-field border bg-transparent py-2 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-ring",
            error ? "border-destructive" : "border-input",
            className,
          )}
          {...props}
        />
        <Icon name="expand" size="sm" tone="muted" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
      </div>
      {error && <p className="mt-1 text-small text-destructive">{error}</p>}
    </div>
  );
});

Select.displayName = "Select";
