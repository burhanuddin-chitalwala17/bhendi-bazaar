import { Icon, type IconName } from "@/components/ui/icon";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";
import type { SocialNetwork } from "@server/catalog/social-networks";
import type { SocialSlice } from "./sections";

/** One glyph per allowlisted network. Adding a network here means adding it to the allowlist first. */
const ICONS: Record<SocialNetwork, IconName> = {
  instagram: "instagram",
  facebook: "facebook",
  youtube: "youtube",
  x: "x-social",
};

/**
 * Handles on known networks, shown as links to those networks and nowhere else (brand-page
 * R8). Every `href` here was composed by the platform from a checked handle
 * (`server/catalog/social-networks.ts`); nothing an org typed reaches an attribute.
 */
export function WaysToFollow({ name, links }: SocialSlice) {
  return (
    <section className="space-y-3">
      <SectionHeader overline="The shop" title={`Follow ${name}`} />
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => {
          const glyph = ICONS[link.network];
          return (
            <li key={link.network}>
              <Button asChild variant="outline" size="sm">
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  aria-label={`${name} on ${link.label}`}
                >
                  <Icon name={glyph} size="md" />
                  <span>@{link.handle}</span>
                </a>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
