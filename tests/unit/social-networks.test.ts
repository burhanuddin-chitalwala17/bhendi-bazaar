/**
 * Ways to follow are handles on known networks, shown as links only to those networks
 * (brand-page R8, D7). An org types a handle; the platform composes the address. These
 * tests pin that a URL, an unknown network or a malformed handle yields no link at all —
 * a buyer sees a link the platform built, or nothing.
 */
import { describe, expect, it } from "vitest";
import {
  SOCIAL_NETWORK_KEYS,
  SOCIAL_NETWORKS,
  normaliseHandle,
  socialLinksFrom,
} from "@server/catalog/social-networks";

const HOSTS: Record<string, string> = {
  instagram: "www.instagram.com",
  facebook: "www.facebook.com",
  youtube: "www.youtube.com",
  x: "x.com",
};

describe("normaliseHandle", () => {
  it("drops a leading @ and surrounding whitespace, since they are the same intent", () => {
    expect(normaliseHandle("instagram", " @silks.co ")).toBe("silks.co");
    expect(normaliseHandle("x", "@bhendi_bazaar")).toBe("bhendi_bazaar");
  });

  it("refuses a URL rather than repairing it", () => {
    expect(normaliseHandle("instagram", "https://www.instagram.com/silks")).toBeNull();
    expect(normaliseHandle("instagram", "instagram.com/silks")).toBeNull();
    expect(normaliseHandle("facebook", "silks/evil")).toBeNull();
  });

  it("holds each network to its own handle shape", () => {
    expect(normaliseHandle("x", "sixteen_chars_xx")).toBeNull();
    expect(normaliseHandle("facebook", "abcd")).toBeNull();
    expect(normaliseHandle("youtube", "ab")).toBeNull();
    expect(normaliseHandle("instagram", "with space")).toBeNull();
    expect(normaliseHandle("instagram", "")).toBeNull();
  });
});

describe("socialLinksFrom", () => {
  it("keeps allowlisted networks with valid handles, in allowlist order, and drops the rest", () => {
    const links = socialLinksFrom({
      x: "@bhendi",
      tiktok: "bhendi",
      facebook: 12345,
      instagram: "silks",
      youtube: "https://youtube.com/@silks",
    });
    expect(links?.map((link) => link.network)).toEqual(["instagram", "x"]);
    expect(links).toEqual([
      { network: "instagram", label: "Instagram", handle: "silks", href: "https://www.instagram.com/silks/" },
      { network: "x", label: "X", handle: "bhendi", href: "https://x.com/bhendi" },
    ]);
  });

  it("answers null when nothing usable is stored", () => {
    expect(socialLinksFrom(null)).toBeNull();
    expect(socialLinksFrom(undefined)).toBeNull();
    expect(socialLinksFrom("instagram.com/silks")).toBeNull();
    expect(socialLinksFrom([])).toBeNull();
    expect(socialLinksFrom({})).toBeNull();
    expect(socialLinksFrom({ instagram: "https://evil.example/phish" })).toBeNull();
    expect(socialLinksFrom({ website: "https://evil.example" })).toBeNull();
  });

  it("composes every address on the network's own host — never one the org supplied", () => {
    // Letters only, five or more: the one shape every network in the allowlist accepts.
    for (const network of SOCIAL_NETWORK_KEYS) {
      const links = socialLinksFrom({ [network]: "silksco" });
      expect(links, network).toHaveLength(1);
      expect(new URL(links![0].href).host).toBe(HOSTS[network]);
      expect(links![0].label).toBe(SOCIAL_NETWORKS[network].label);
    }
  });
});
