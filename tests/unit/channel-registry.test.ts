import { describe, expect, it } from "vitest";

import {
  CHANNEL,
  CHANNELS,
  CHANNEL_KIND,
  CHANNEL_KINDS,
  CHANNEL_LABELS,
  PUBLISHABLE_CHANNELS,
  isChannel,
  kindOf,
} from "@server/shared/channels";
import { CHANNEL_IMAGE_RULES } from "@server/content/channel-rules";

/**
 * The channel set is declared, not stored ([channel-registry](../../docs/specs/channel-registry/) D1):
 * one needs an image rule, a readiness rule and an adapter before it can do anything, so a row
 * an admin could add would be a row that does nothing.
 *
 * What these hold is that the declaration stays whole. A channel added to the set and forgotten
 * in one of the records beside it is a channel that silently has no rule — and TypeScript only
 * catches that while the records are `Record<Channel, …>`, which is itself worth asserting.
 */
describe("every channel is declared everywhere it has to be", () => {
  it("has a kind", () => {
    for (const channel of CHANNELS) {
      expect(CHANNEL_KINDS[channel], channel).toBeDefined();
    }
  });

  it("has a label a shop would recognise", () => {
    for (const channel of CHANNELS) {
      expect(CHANNEL_LABELS[channel]?.length, channel).toBeGreaterThan(0);
    }
  });

  it("has an image rule, or `null` saying deliberately none", () => {
    for (const channel of CHANNELS) {
      expect(channel in CHANNEL_IMAGE_RULES, channel).toBe(true);
    }
  });

  it("names each channel once", () => {
    expect(new Set(CHANNELS).size).toBe(CHANNELS.length);
  });
});

/**
 * The kind decides what machinery a channel gets
 * ([ADR-0041](../../docs/adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)), so a
 * channel in the wrong one would be given credentials it cannot use or denied a feed it needs.
 */
describe("a channel's kind says what it gets", () => {
  it("knows this storefront is the storefront, and the only one", () => {
    expect(kindOf(CHANNEL.STORE)).toBe(CHANNEL_KIND.STOREFRONT);
    const storefronts = CHANNELS.filter((c) => kindOf(c) === CHANNEL_KIND.STOREFRONT);
    expect(storefronts).toEqual([CHANNEL.STORE]);
  });

  // The sale completes here, so they get a feed and nothing else — no credentials, no order
  // reader, no stock reconciliation, because no stock can diverge.
  it("classes Google and Meta as shopfronts", () => {
    expect(kindOf(CHANNEL.GOOGLE)).toBe(CHANNEL_KIND.SHOPFRONT);
    expect(kindOf(CHANNEL.META)).toBe(CHANNEL_KIND.SHOPFRONT);
  });

  it("classes the three marketplaces as marketplaces", () => {
    for (const channel of [CHANNEL.AMAZON, CHANNEL.FLIPKART, CHANNEL.MEESHO]) {
      expect(kindOf(channel), channel).toBe(CHANNEL_KIND.MARKETPLACE);
    }
  });

  it("publishes to everything except this storefront", () => {
    expect(PUBLISHABLE_CHANNELS).not.toContain(CHANNEL.STORE);
    expect(PUBLISHABLE_CHANNELS).toHaveLength(CHANNELS.length - 1);
  });
});

describe("reading a stored channel key", () => {
  it("accepts a declared one and refuses anything else", () => {
    expect(isChannel(CHANNEL.FLIPKART)).toBe(true);
    // `instagram` was in the set until the registry replaced it with `meta`, which serves both
    // Facebook and Instagram through one feed. Nothing had stored it.
    for (const bad of ["instagram", "Flipkart", "", "ondc", "amazon.in"]) {
      expect(isChannel(bad), bad).toBe(false);
    }
  });
});
