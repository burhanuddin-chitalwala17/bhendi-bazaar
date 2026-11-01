import Link from "next/link";

import { formatCount } from "@/lib/format";

/** A themed section's title: the theme's display face and tracking, its label face above. */
export function SectionHeading({
  title,
  overline,
  action,
  align = "start",
}: {
  title: string;
  overline?: string;
  action?: { label: string; href: string };
  align?: "start" | "center";
}) {
  return (
    <div
      className={
        align === "center"
          ? "flex flex-col items-center gap-2 text-center"
          : "flex items-end justify-between gap-4"
      }
    >
      <div className="min-w-0 space-y-1">
        {overline && (
          <p className="font-label text-tag uppercase tracking-tag text-muted-foreground">{overline}</p>
        )}
        <h2 className="font-display text-title tracking-headline text-foreground">{title}</h2>
      </div>
      {action && (
        <Link
          href={action.href}
          prefetch={false}
          className="shrink-0 font-label text-tag uppercase tracking-tag text-foreground underline underline-offset-4"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export const shopHref = (handle: string) => `/store/${handle}/shop`;
export const shopAllLabel = (count: number) => `Shop all ${formatCount(count)}`;
export const landingHref = (handle: string) => `/store/${handle}`;
export const dealsHref = (handle: string) => `${shopHref(handle)}?deals=1`;

/** Q33: a product reached from a shop keeps that shop's chrome; the canonical stays `/product/{slug}`. */
export const storefrontProductHref = (slug: string, handle: string) =>
  `/product/${slug}?shop=${encodeURIComponent(handle)}`;

/** Past this many characters the button reads "Visit shop" (own-store Q23). */
export const VISIT_NAME_MAX = 20;
export const visitLabel = (name: string) =>
  name.length > VISIT_NAME_MAX ? "Visit shop" : `Visit ${name}`;
