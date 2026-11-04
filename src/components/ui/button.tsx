import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-field text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[error]:animate-pulse data-[error]:ring-2 data-[error]:ring-destructive/40 data-[error]:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-primary-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-inset-field hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        // On a dark surface (the selection bar): a quiet button that inherits the surface's light text.
        inverse: "bg-background/10 text-background hover:bg-background/20",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "min-h-10 md:min-h-0 md:h-8 rounded-field gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-field px-6 has-[>svg]:px-4",
      },
      // A separate axis from size (ADR-0066 D9): a square icon button at any size.
      shape: {
        default: "",
        icon: "p-0 has-[>svg]:p-0",
      },
    },
    compoundVariants: [
      { shape: "icon", size: "default", className: "size-9" },
      { shape: "icon", size: "sm", className: "size-10 md:size-8 md:min-h-0" },
      { shape: "icon", size: "lg", className: "size-10" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "default",
    },
  },
);

const ignoreClick = (event: React.MouseEvent) => event.preventDefault();

function Button({
  className,
  variant = "default",
  size = "default",
  shape = "default",
  asChild = false,
  pending = false,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Work this button started is in flight: shows a spinner and ignores further clicks, but
     * stays enabled and focusable, so the reason is readable and nothing looks dead
     * (docs/GTM-READINESS.md B9). Prefer this to `disabled`. Buttons only: with `asChild` the
     * child's own click (a link's navigation) runs before ours can stop it.
     */
    pending?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-shape={shape}
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      className={cn(buttonVariants({ variant, size, shape, className }), pending && "cursor-progress")}
      // Only a pending button gets a handler of ours: a server component renders this primitive
      // too, and cannot pass a function. `pending` is client state, so that never meets one.
      onClick={pending ? ignoreClick : onClick}
      {...props}
    >
      {pending && !asChild ? (
        <>
          <Spinner />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
