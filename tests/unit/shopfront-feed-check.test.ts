/**
 * The proof run's feed check against Google's and Meta's published rules (listing-model/field-maps R7, Q5).
 */
import { describe, expect, it } from "vitest";

import { buildFeed, type FeedCandidate } from "@server/listing/shopfront-feed";
import { checkFeed } from "@server/listing/shopfront-feed-check";

const candidate = (over: Partial<FeedCandidate> = {}): FeedCandidate => ({
  id: "p1", title: "Black Abaya", description: "Nida, full length.", link: "https://shop.example/p", images: ["https://img.example/a.jpg"],
  pricePaise: 249_900, offerPricePaise: null, inStock: true, brand: "Al Noor", category: "1604",
  attributes: [{ path: "color", value: "Black" }, { path: "gender", value: "female" }, { path: "age_group", value: "adult" }, { path: "size", value: "Free Size" }],
  ...over,
});
const check = (channel: "google" | "meta", c: FeedCandidate) => checkFeed(channel, buildFeed(channel, { title: "BB", link: "https://shop.example" }, [c]));

describe("a feed item against the channel's rules", () => {
  it("passes an apparel item with colour, gender, age group and size on both channels", () => {
    expect(check("google", candidate())).toEqual([{ id: "p1", category: "1604", problems: [] }]);
    expect(check("meta", candidate())).toEqual([{ id: "p1", category: "1604", problems: [] }]);
  });

  it("names what Google's free listings need on apparel, and a value outside its list", () => {
    const [item] = check("google", candidate({ attributes: [{ path: "gender", value: "women" }] }));
    expect(item.problems).toEqual(["missing color", "missing age_group", "missing size", 'gender "women" is not one of male, female, unisex']);
  });

  it("does not ask apparel attributes of a non-apparel category", () => {
    const [item] = check("google", candidate({ category: "3686", attributes: [] }));
    expect(item.problems).toEqual([]);
  });

  it("reads Meta's own availability words", () => {
    const [item] = check("meta", candidate({ inStock: false }));
    expect(item.problems).toEqual([]);
  });
});
