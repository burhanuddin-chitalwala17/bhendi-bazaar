import { HeroSlider } from "./hero-slider";
import type { HeroBannerContent } from "./hero-banner";

/** The storefront's hero. Content is admin-managed; see docs/specs/home-banners/. */
export function HomeHero({ banners }: { banners: HeroBannerContent[] }) {
  if (banners.length === 0) return null;
  return <HeroSlider banners={banners} />;
}
