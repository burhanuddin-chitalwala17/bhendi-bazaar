import { SectionHeader } from "@/components/shared/SectionHeader";
import type { StorySlice } from "./sections";

/**
 * Who this shop is, in its own words. Plain text rendered as text (ADR-0030 D9, brand-page
 * R9): paragraphs survive through `whitespace-pre-line`, and a very long unbroken string
 * wraps rather than widening the page. The owner's portrait and line join in part (b).
 */
export function BrandStory({ name, about, story }: StorySlice) {
  return (
    <section className="space-y-3">
      <SectionHeader overline="The shop" title={`About ${name}`} />
      {about && (
        <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground/90">
          {about}
        </p>
      )}
      {story && (
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
          {story}
        </p>
      )}
    </section>
  );
}
