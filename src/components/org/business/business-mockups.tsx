import type { ReactNode } from "react";

import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { Icon } from "@/components/ui/icon";
import { PlatformMark } from "@/components/ui/icons/platform-marks";
import { cn } from "@/lib/utils";

import { BUSINESS_COPY } from "./business-copy";

/**
 * The product, drawn rather than screenshotted: the seed catalogue is placeholder data, and a
 * marketing page must show the real screens' shape with content a shop would recognise.
 */
const M = BUSINESS_COPY.mockup;

function Phone({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("w-64 shrink-0 rounded-4xl bg-foreground p-2 shadow-overlay ring-1 ring-foreground/10 md:w-72", className)}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-4xl bg-background">
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
        tint === "primary" && "bg-gradient-to-br from-primary/20 to-primary/5 text-primary",
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

export function ChannelsMockup({ className }: { className?: string }) {
  const { product, channels } = BUSINESS_COPY.hub;
  return (
    <Phone label={M.channelsLabel} className={className}>
      <div className="flex items-center gap-3">
        <ProductTile tint="primary" className="w-14" />
        <div className="min-w-0">
          <p className="truncate text-small font-semibold">{product.name}</p>
          <p className="text-caption text-muted-foreground">{product.price}</p>
        </div>
      </div>
      <ul className="divide-y divide-border rounded-card border border-border bg-card">
        {channels.map((channel) => (
          <li key={channel.name} className="flex items-center gap-2 px-2.5 py-2">
            {channel.mark ? (
              <PlatformMark name={channel.mark} size="sm" />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-field bg-primary text-primary-foreground">
                <Icon name="shop" size="sm" />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-caption">{channel.name}</span>
            <StatusBadge tone="success" dot>
              {M.live}
            </StatusBadge>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Icon name="refresh" size="xs" tone="primary" />
        {M.synced}
      </p>
    </Phone>
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
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-card border border-border bg-card p-2.5">
          <Icon name="parcel" size="sm" tone="primary" />
          <span className="flex-1 text-caption">{M.toPack}</span>
          <span className="rounded-full bg-primary px-2.5 py-1 text-2xs font-semibold text-primary-foreground">
            {M.markPacked}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-card border border-border bg-card p-2.5">
          <Icon name="warning" size="sm" tone="warning" />
          <span className="flex-1 text-caption">{M.lowStock}</span>
          <Icon name="next" size="xs" tone="muted" />
        </div>
      </div>
    </Phone>
  );
}

/** Beside the hero's phone: the same product, live everywhere, one stock count. */
export function LiveEverywhereCard({ className }: { className?: string }) {
  const marks = BUSINESS_COPY.hub.channels.flatMap((c) => (c.mark ? [c.mark] : []));
  return (
    <div role="img" aria-label={M.channelsLabel} className={cn("w-56 rounded-card border border-border bg-card p-4 shadow-overlay", className)}>
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

/** Beside the hero's phone: a marketplace order landing on the same screen as the store's. */
export function NewOrderCard({ className }: { className?: string }) {
  return (
    <div role="img" aria-label={M.orderLabel} className={cn("w-56 rounded-card border border-border bg-card p-3 shadow-overlay", className)}>
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

export const FEATURE_MOCKUPS = {
  store: StoreMockup,
  photos: PhotoMockup,
  everywhere: ChannelsMockup,
  business: OrdersMockup,
} as const;
