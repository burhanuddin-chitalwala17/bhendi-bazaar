import { HeroSlider } from "./hero-slider";
import type { HeroBannerContent } from "./hero-banner";

/**
 * The marketplace's hero, edge to edge and flush under the header (owner, 2026-11-05): it lifts
 * past the page's top padding. Content is admin-managed; see docs/specs/home-banners/.
 */
export function HomeHero({ banners }: { banners: HeroBannerContent[] }) {
  if (banners.length === 0) return null;
  return (
    <div className="bleed -mt-4 md:-mt-8">
      <HeroSlider banners={banners} edge="bleed" />
    </div>
  );
}
