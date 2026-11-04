import Image from "next/image";

import { cn } from "@/lib/utils";
import type { SectionVariant } from "@server/catalog/storefront-themes";
import type { StorySlice } from "./page-data";
import { SectionHeading } from "./section-heading";
import { THEMED_COPY } from "./themed-copy";

/**
 * "About your shop" and the person behind it (Q10), plain, with a drop cap, or in two
 * columns. Text is text (ADR-0030 D9): paragraphs by `whitespace-pre-line`, long strings wrap.
 */
export function ThemedStory({
  variant,
  name,
  about,
  owner,
}: StorySlice & { variant: SectionVariant<"story"> }) {
  const twoColumn = variant === "twoColumn";
  return (
    <section className="mx-auto max-w-store space-y-4 px-gutter py-section">
      <SectionHeading title={THEMED_COPY.sections.story} overline={name} />
      <div className={cn("space-y-4", twoColumn && "md:grid md:grid-cols-2 md:gap-section md:space-y-0")}>
        {about && (
          <p
            className={cn(
              "whitespace-pre-line break-words text-body",
              variant === "dropCap" &&
                "first-letter:float-left first-letter:mr-2 first-letter:font-display first-letter:text-headline first-letter:leading-none",
            )}
          >
            {about}
          </p>
        )}
        {owner && (
          <figure className="flex items-start gap-3">
            {owner.photoUrl && (
              <Image
                src={owner.photoUrl}
                alt={owner.name}
                width={64}
                height={64}
                sizes="64px"
                className="size-16 shrink-0 rounded-full object-cover"
              />
            )}
            <div className="min-w-0 space-y-1">
              {owner.quote && (
                <blockquote className="whitespace-pre-line break-words text-body italic">{owner.quote}</blockquote>
              )}
              <figcaption className="font-label text-tag uppercase tracking-tag text-muted-foreground">
                {owner.name}
                {owner.role && `, ${owner.role}`}
              </figcaption>
            </div>
          </figure>
        )}
      </div>
    </section>
  );
}
