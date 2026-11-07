import { CHANNEL } from "@server/shared/channels";

import type { ShopfrontChannel } from "./shopfront-feed";

/**
 * A feed item checked against what Google and Meta publish as their product rules (listing-model/field-maps
 * R7, Q5), the stand-in for validators neither offers outside a merchant account. Pure.
 * Google: support.google.com/merchants/answer/7052112 (read 2026-11-07). Meta:
 * developers.facebook.com/docs/marketing-api/catalog/reference (read 2026-11-07).
 */

interface Rules {
  required: string[];
  max: Record<string, number>;
  oneOf: Record<string, readonly string[]>;
  /** Categories whose items must also carry these, and which. */
  apparel: { categories: ReadonlySet<string>; required: string[] };
  clothing: { categories: ReadonlySet<string>; required: string[] };
}

/** Apparel & Accessories (166) and its children our map publishes to; Clothing (1604) and its own. */
const APPAREL = new Set(["1604", "200", "204", "209", "3032", "543673"]);
const CLOTHING = new Set(["1604", "204", "209"]);
const PRICE = /^\d+\.\d{2} [A-Z]{3}$/;

const RULES: Record<ShopfrontChannel, Rules> = {
  [CHANNEL.GOOGLE]: {
    required: ["id", "title", "description", "link", "image_link", "availability", "price", "brand"],
    max: { id: 50, title: 150, description: 5000, brand: 70, color: 100, size: 100, material: 200, pattern: 100 },
    oneOf: {
      availability: ["in_stock", "out_of_stock", "preorder", "backorder"], condition: ["new", "refurbished", "used"],
      gender: ["male", "female", "unisex"], age_group: ["newborn", "infant", "toddler", "kids", "adult"], identifier_exists: ["yes", "no"],
    },
    // Free listings require these on all of Apparel & Accessories, size on Clothing.
    apparel: { categories: APPAREL, required: ["color", "gender", "age_group"] },
    clothing: { categories: CLOTHING, required: ["size"] },
  },
  [CHANNEL.META]: {
    required: ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "google_product_category"],
    max: { id: 100, title: 200, description: 9999, brand: 100, color: 200, size: 200, material: 200, pattern: 100 },
    oneOf: {
      availability: ["in stock", "out of stock"], condition: ["new", "refurbished", "used"], gender: ["female", "male", "unisex"],
      age_group: ["adult", "all ages", "teen", "kids", "toddler", "infant", "newborn"],
    },
    apparel: { categories: APPAREL, required: ["color"] },
    clothing: { categories: CLOTHING, required: ["size"] },
  },
};

const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** An item's `g:` tags; a repeated tag keeps its first value. */
function tagsOf(item: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const m of item.matchAll(/<g:([a-z_]+)>([\s\S]*?)<\/g:\1>/g)) if (!tags.has(m[1])) tags.set(m[1], unescape(m[2]));
  return tags;
}

export interface FeedItemCheck {
  id: string;
  category: string | null;
  problems: string[];
}

export function checkFeed(channel: ShopfrontChannel, xml: string): FeedItemCheck[] {
  const rules = RULES[channel];
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, body]) => {
    const tags = tagsOf(body);
    const category = tags.get("google_product_category") ?? null;
    const problems: string[] = [];
    const required = [
      ...rules.required,
      ...(category && rules.apparel.categories.has(category) ? rules.apparel.required : []),
      ...(category && rules.clothing.categories.has(category) ? rules.clothing.required : []),
    ];
    for (const tag of required) if (!tags.get(tag)?.trim()) problems.push(`missing ${tag}`);
    for (const [tag, max] of Object.entries(rules.max)) if ((tags.get(tag)?.length ?? 0) > max) problems.push(`${tag} longer than ${max}`);
    for (const [tag, allowed] of Object.entries(rules.oneOf)) {
      const v = tags.get(tag);
      if (v !== undefined && !allowed.includes(v)) problems.push(`${tag} "${v}" is not one of ${allowed.join(", ")}`);
    }
    const price = tags.get("price");
    if (price !== undefined && !PRICE.test(price)) problems.push(`price "${price}" is not "0.00 INR"`);
    return { id: tags.get("id") ?? "?", category, problems };
  });
}
