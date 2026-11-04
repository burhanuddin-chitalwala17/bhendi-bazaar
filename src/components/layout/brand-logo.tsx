import Image from "next/image";
import { cva, type VariantProps } from "class-variance-authority";

import { APP_NAME, LOGO } from "@/lib/config";
import { cn } from "@/lib/utils";

const logoVariants = cva("w-auto select-none", {
  variants: {
    size: { sm: "h-8", md: "h-10 sm:h-12", lg: "h-12 sm:h-16" },
    // The logo is black line art: on a dark surface it is inverted, never redrawn.
    tone: { ink: "", light: "invert" },
  },
  defaultVariants: { size: "md", tone: "ink" },
});

interface BrandLogoProps extends VariantProps<typeof logoVariants> {
  /** True only where the logo is the page's first paint (the store header). */
  priority?: boolean;
  className?: string;
}

/** The platform's logo, the one file in public/brand (config `LOGO`); every chrome renders it here. */
export function BrandLogo({ size, tone, priority, className }: BrandLogoProps) {
  return (
    <Image
      src={LOGO.FULL}
      alt={APP_NAME}
      width={160}
      height={160}
      fetchPriority={priority ? "high" : undefined}
      className={cn(logoVariants({ size, tone }), className)}
    />
  );
}
