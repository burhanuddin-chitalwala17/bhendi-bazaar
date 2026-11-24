import type { MarketplaceChannel } from "./channel-connection.types";
import { metaConfigured } from "./providers/meta/settings";
import type { SocialPlatform } from "./social/types";

/**
 * The one switch (TRD D10, decision Q10): `CHANNELS_CONNECT` lists the marketplaces open to
 * connect. Read here and nowhere else, so it gates the connect route and the card's state without
 * shaping anything around it.
 */
export function openMarketplaces(): Set<string> {
  const raw = process.env.CHANNELS_CONNECT ?? "";
  return new Set(
    raw
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const isOpen = (channel: MarketplaceChannel): boolean => openMarketplaces().has(channel);

/**
 * Instagram and WhatsApp open separately (meta-foundation R10, D8): listed in `SOCIAL_CONNECT` and
 * with the Meta app's settings present, so a half-configured deployment never offers a connect.
 */
export function isSocialOpen(platform: SocialPlatform): boolean {
  const listed = (process.env.SOCIAL_CONNECT ?? "").split(",").map((name) => name.trim().toLowerCase());
  return listed.includes(platform) && metaConfigured(platform);
}
