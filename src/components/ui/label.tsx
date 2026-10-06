import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * `default` is the standalone form label; `eyebrow` is the small-caps caption `FormField`
 * puts over every control — inline and without a margin of its own, because the field's
 * `space-y` already sets the gap. Merged with `cn` so a caller's class wins over the base.
 */
const labelVariants = cva("font-medium", {
  variants: {
    variant: {
      default: "block text-sm text-foreground/80 mb-1",
      eyebrow: "text-2xs uppercase tracking-eyebrow",
    },
  },
  defaultVariants: { variant: "default" },
});

interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {
  required?: boolean;
}

export function Label({
  children,
  required,
  variant,
  className,
  ...props
}: LabelProps) {
  return (
    <label className={cn(labelVariants({ variant }), className)} {...props}>
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
  );
}
