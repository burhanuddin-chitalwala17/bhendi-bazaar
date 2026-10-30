import Image from "next/image";

import { SectionHeader } from "@/components/shared/SectionHeader";
import type { StorySlice } from "./sections";

/**
 * Who this shop is, in its own words. Plain text rendered as text (ADR-0030 D9, brand-page
 * R9): paragraphs survive through `whitespace-pre-line`, and a very long unbroken string
 * wraps rather than widening the page.
 *
 * The person comes last and is invited, never required (R5). A shop that named nobody shows
 * the words alone, with nothing to say a name is missing.
 */
export function BrandStory({ name, about, owner }: StorySlice) {
  return (
    <section className="space-y-3">
      <SectionHeader overline="The shop" title={`About ${name}`} />
      {about && (
        <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground/90">
          {about}
        </p>
      )}
      {owner && (
        <figure className="flex items-start gap-3 rounded-card border border-border/60 bg-muted/40 p-4">
          {owner.photoUrl && (
            <Image
              src={owner.photoUrl}
              alt={owner.name}
              width={56}
              height={56}
              sizes="56px"
              className="size-14 shrink-0 rounded-full object-cover"
            />
          )}
          <div className="min-w-0 space-y-1">
            {owner.quote && (
              <blockquote className="whitespace-pre-line break-words text-sm italic leading-relaxed text-foreground/90">
                {owner.quote}
              </blockquote>
            )}
            <figcaption className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{owner.name}</span>
              {owner.role && <span>, {owner.role}</span>}
            </figcaption>
          </div>
        </figure>
      )}
    </section>
  );
}
