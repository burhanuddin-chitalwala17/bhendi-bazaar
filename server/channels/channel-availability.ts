import type { MarketplaceChannel } from "./channel-connection.types";

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
