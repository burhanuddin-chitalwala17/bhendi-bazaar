import Image from "next/image";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { Icon } from "@/components/ui/icon";
import { PlatformMark } from "@/components/ui/icons/platform-marks";
import { cn } from "@/lib/utils";

import { BUSINESS_COPY } from "./business-copy";

/**
 * The product, drawn rather than screenshotted where a shop's own data would show, and the live
 * site photographed where a partner needs to see the real page their banner would sit on.
 * No people: the page sells the platform, not a portrait (owner, 2026-11-14).
 */
const M = BUSINESS_COPY.mockup;

/** Captured from bhendi-bazaar.com at 1280×800, 1.5×. Re-capture when the home page changes. */
export const SITE_SHOTS = {
  home: "/business/site-home.webp",
  category: "/business/site-category.webp",
} as const;

function Phone({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("w-64 shrink-0 rounded-4xl bg-foreground p-2 shadow-overlay ring-1 ring-foreground/10 md:w-72", className)}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-4xl bg-background text-foreground">
        <div aria-hidden className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-foreground/15" />
        <div aria-hidden className="flex flex-1 flex-col gap-3 p-4">{children}</div>
      </div>
    </div>
  );
}

/** A product photograph's place, drawn as the brand's rida on a soft tile. */
function ProductTile({ tint, className }: { tint: "primary" | "accent" | "muted"; className?: string }) {
  return (
    <div
      className={cn(
        "flex aspect-square items-center justify-center rounded-card",
        tint === "primary" && "bg-gradient-to-br from-primary/25 to-primary/5 text-primary",
        tint === "accent" && "bg-gradient-to-br from-accent to-accent/30 text-accent-foreground",
        tint === "muted" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <Icon name="rida" size="2xl" />
    </div>
  );
}

export function StoreMockup({ className }: { className?: string }) {
  return (
    <Phone label={M.storeLabel} className={className}>
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon name="shop" size="sm" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-body font-bold">{M.shopName}</p>
          <p className="truncate text-2xs text-muted-foreground">{M.shopTagline}</p>
        </div>
      </div>
      <div className="flex gap-1.5">
        {M.storeTabs.map((tab, i) => (
          <span
            key={tab}
            className={cn(
              "rounded-full px-2.5 py-1 text-2xs",
              i === 0 ? "bg-foreground text-background" : "border border-border text-muted-foreground",
            )}
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {M.products.map((product, i) => (
          <div key={product.name} className="space-y-1">
            <ProductTile tint={i === 0 ? "primary" : "accent"} />
            <p className="truncate text-2xs">{product.name}</p>
            <p className="text-caption font-semibold">{product.price}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 rounded-full bg-primary py-2 text-caption font-semibold text-primary-foreground">
        <Icon name="bag" size="xs" />
        {M.addToBag}
      </div>
    </Phone>
  );
}

export function PhotoMockup({ className }: { className?: string }) {
  return (
    <div role="img" aria-label={M.photoLabel} className={cn("w-full max-w-md space-y-3", className)}>
      <div aria-hidden className="grid grid-cols-2 gap-3">
        <figure className="space-y-2">
          <div className="relative overflow-hidden rounded-card bg-muted">
            {/* The shop counter behind a phone photo: shapes, not a picture of anything. */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-foreground/10" />
            <div className="absolute left-3 top-4 size-10 rounded-full bg-accent/60" />
            <ProductTile tint="muted" className="relative -rotate-3 bg-transparent" />
          </div>
          <figcaption className="text-caption text-muted-foreground">{M.before}</figcaption>
        </figure>
        <figure className="space-y-2">
          <div className="relative rounded-card border border-border bg-card shadow-lifted">
            <ProductTile tint="primary" className="bg-transparent" />
            <StatusBadge tone="success" className="absolute right-2 top-2">
              <Icon name="done" size="xs" />
            </StatusBadge>
          </div>
          <figcaption className="text-caption font-semibold text-primary">{M.after}</figcaption>
        </figure>
      </div>
      <div aria-hidden className="flex flex-wrap gap-2">
        {M.tools.map((tool, i) => (
          <span
            key={tool}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-caption",
              i === 1 ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground",
            )}
          >
            {i === 1 && <Icon name="enhance" size="xs" />}
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A sheet of rows on the left becoming product tiles on the right. */
export function CatalogueMockup({ className }: { className?: string }) {
  return (
    <div role="img" aria-label={M.catalogueLabel} className={cn("grid w-full max-w-md grid-cols-5 items-center gap-3", className)}>
      <div aria-hidden className="col-span-3 overflow-hidden rounded-card border border-border bg-card text-2xs shadow-lifted">
        <div className="grid grid-cols-3 gap-2 border-b border-border bg-muted px-3 py-2 font-semibold">
          {M.sheetHeader.map((cell) => (
            <span key={cell}>{cell}</span>
          ))}
        </div>
        {M.sheetRows.map((row) => (
          <div key={row[0]} className="grid grid-cols-3 gap-2 border-b border-border px-3 py-2 last:border-b-0">
            {row.map((cell) => (
              <span key={cell} className="truncate">
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div aria-hidden className="col-span-2 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          {(["primary", "accent", "accent", "primary"] as const).map((tint, i) => (
            <ProductTile key={i} tint={tint} />
          ))}
        </div>
        <p className="flex items-center gap-1 text-2xs font-semibold text-primary">
          <Icon name="done" size="xs" />
          {M.addedCount}
        </p>
      </div>
    </div>
  );
}

export function OrdersMockup({ className }: { className?: string }) {
  return (
    <Phone label={M.ordersLabel} className={className}>
      <div className="rounded-card bg-foreground p-3 text-background">
        <p className="text-2xs text-background/70">{M.earned}</p>
        <p className="font-heading text-headline font-bold">{M.earnedValue}</p>
        <div className="mt-2 flex h-10 items-end gap-1">
          {[40, 55, 35, 70, 60, 85, 100].map((h) => (
            <span key={h} className="flex-1 rounded-field bg-primary" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <p className="text-small font-semibold">{M.needsYou}</p>
      <div className="flex items-center gap-2 rounded-card border border-border bg-card p-2.5">
        <Icon name="parcel" size="sm" tone="primary" />
        <span className="flex-1 text-caption">{M.toPack}</span>
      </div>
      <div className="flex items-center gap-2 rounded-card bg-primary/10 p-2.5 text-primary">
        <Icon name="success" size="sm" />
        <span className="flex-1 text-caption font-semibold">{M.courierBooked}</span>
      </div>
    </Phone>
  );
}

/** Beside the hero's phone: a marketplace order landing on the same screen as the store's. */
export function NewOrderCard({ className }: { className?: string }) {
  return (
    <div role="img" aria-label={M.orderLabel} className={cn("w-56 rounded-card border border-border bg-card p-3 text-card-foreground shadow-overlay", className)}>
      <div aria-hidden className="flex items-center gap-3">
        <PlatformMark name="amazon" size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold">{M.newOrder}</p>
          <p className="truncate text-2xs text-muted-foreground">{M.newOrderFrom}</p>
        </div>
        <Icon name="parcel" size="sm" tone="primary" />
      </div>
    </div>
  );
}

/** Beside the hero's phone: the same product, live everywhere, one stock count. */
export function LiveEverywhereCard({ className }: { className?: string }) {
  const marks = BUSINESS_COPY.shop.everywhere.places.flatMap((p) => (p.mark && p.status === "live" ? [p.mark] : []));
  return (
    <div role="img" aria-label={M.liveOn} className={cn("w-56 rounded-card border border-border bg-card p-4 text-card-foreground shadow-overlay", className)}>
      <div aria-hidden className="space-y-3">
        <p className="text-caption font-semibold">{M.liveOn}</p>
        <div className="flex gap-1.5">
          {marks.map((mark) => (
            <PlatformMark key={mark} name={mark} size="sm" />
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Icon name="refresh" size="xs" tone="primary" />
          {M.synced}
        </p>
      </div>
    </div>
  );
}

/** A browser window around a photograph of the live site, with whatever sits on top of it. */
export function SiteShot({
  src,
  alt,
  sizes,
  priority,
  className,
  children,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <figure className={cn("overflow-hidden rounded-card border border-border bg-card shadow-overlay", className)}>
      <div aria-hidden className="flex items-center gap-1.5 border-b border-border bg-muted px-3 py-2">
        <span className="size-2 rounded-full bg-foreground/20" />
        <span className="size-2 rounded-full bg-foreground/20" />
        <span className="size-2 rounded-full bg-foreground/20" />
      </div>
      <div className="relative aspect-video">
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover object-top" />
        {children}
      </div>
    </figure>
  );
}

/** The banner a partner's name would fill, drawn over a site photograph. */
export function BrandBanner({ label, note, className }: { label: string; note?: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center justify-center gap-2 rounded-card border border-dashed border-accent bg-scrim/90 px-4 py-3 text-on-photo shadow-overlay",
        className,
      )}
    >
      <span className="size-4 shrink-0 rounded-full border-2 border-accent" />
      <span className="text-caption font-bold uppercase tracking-eyebrow">{label}</span>
      {note && <span className="text-2xs text-accent">{note}</span>}
    </div>
  );
}

/** One of Bhendi Bazaar's own posts, co-branded. */
export function CampaignMockup({ className }: { className?: string }) {
  const c = BUSINESS_COPY.partner.placements.campaign;
  const brand = BUSINESS_COPY.partner.hero.brand;
  return (
    <div role="img" aria-label={c.label} className={cn("w-full overflow-hidden rounded-card border border-border bg-card shadow-overlay", className)}>
      <div aria-hidden>
        <div className="relative flex aspect-video flex-col justify-end gap-1 bg-gradient-to-br from-primary to-hero p-4 text-primary-foreground">
          <div className="absolute inset-0 flex items-center justify-center text-primary-foreground/20">
            <Icon name="rida" size="2xl" />
          </div>
          <span className="absolute right-3 top-3">
            <PlatformMark name="instagram" size="sm" />
          </span>
          <p className="relative font-heading text-title font-bold">{c.postTitle}</p>
          <p className="relative text-caption text-primary-foreground/80">{c.postBody}</p>
        </div>
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <BrandLogo size="sm" className="h-6" />
          <span className="ml-auto text-2xs text-muted-foreground">{c.presentedBy}</span>
          <span className="rounded-full border border-dashed border-accent px-2 py-0.5 text-2xs font-bold uppercase tracking-eyebrow">
            {brand}
          </span>
        </div>
      </div>
    </div>
  );
}

export const FEATURE_MOCKUPS = {
  catalogue: CatalogueMockup,
  photos: PhotoMockup,
  store: StoreMockup,
  orders: OrdersMockup,
} as const;
