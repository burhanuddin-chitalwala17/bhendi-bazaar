import { cn } from "@/lib/utils";
import { HeroBannerScrim, HeroBannerWords, hasHeroWords, type HeroBannerContent } from "@/components/home/hero-banner";
import { SlotPreview } from "@/components/shared/image-slot/slot-preview";
import { IMAGE_SLOT, IMAGE_SLOTS, ratioOf } from "@server/catalog/image-slots";
import type { ResponsiveImageDto } from "@server/catalog/image-framing";

const SHAPES = IMAGE_SLOTS[IMAGE_SLOT.ORG_BANNER];

/**
 * The banner as buyers will see it, before it is saved: the desktop and phone frames side by side,
 * each with the picture framed as saved and the live banner's own words over it (`HeroBannerWords`),
 * so the preview cannot say something the shop page would not.
 */
export function BannerPreview({
  words,
  image,
}: {
  words: Omit<HeroBannerContent, "id" | "image">;
  image: Omit<ResponsiveImageDto, "alt"> | null;
}) {
  const withWords = hasHeroWords(words);
  return (
    <section aria-label="Preview" className="space-y-2">
      <h3 className="text-label uppercase text-muted-foreground">How it will look</h3>
      <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <figure className="space-y-1 sm:col-span-2">
          <SlotPreview
            side={image?.desktop ?? null}
            aspect={ratioOf(SHAPES.desktop)}
            sizes="(min-width: 768px) 26rem, 100vw"
            className={cn("isolate flex items-center rounded-card border-0 px-4 py-3 text-hero-foreground", !image && "bg-hero")}
          >
            {image && withWords && <HeroBannerScrim frame="desktop" className="z-0" />}
            {withWords && <HeroBannerWords banner={words} frame="desktop" preview />}
          </SlotPreview>
          <figcaption className="text-caption text-muted-foreground">Desktop and tablet</figcaption>
        </figure>
        <figure className="w-1/2 space-y-1 sm:w-auto">
          <SlotPreview
            side={image?.phone ?? null}
            aspect={ratioOf(SHAPES.phone)}
            sizes="(min-width: 640px) 12rem, 50vw"
            className={cn("isolate flex items-end rounded-card border-0 p-2 text-hero-foreground", !image && "bg-hero")}
          >
            {image && withWords && <HeroBannerScrim frame="phone" className="z-0" />}
            {withWords && <HeroBannerWords banner={words} frame="phone" preview />}
          </SlotPreview>
          <figcaption className="text-caption text-muted-foreground">Phone</figcaption>
        </figure>
      </div>
      {!image && (
        <p className="text-caption text-muted-foreground">No picture yet: the banner shows on your shop&apos;s plain colour.</p>
      )}
    </section>
  );
}
