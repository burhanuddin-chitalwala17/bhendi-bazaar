import {
  CAPTION_COPY,
  CAPTION_LANGUAGE,
  CAPTION_MAX_CHARS,
  CAPTION_MAX_HASHTAGS,
  type CaptionFacts,
  type CaptionPriceChangeDto,
  type CaptionProductFacts,
} from "@server/content/caption.types";

/**
 * What a caption may say about money (ai-images/social-posts D3, D4). Pure: the service reads the
 * live facts, these decide. A number in a caption is a claim, so every one must come from the facts.
 */

const DEVANAGARI_ZERO = 0x0966;
/** Devanagari digits read as ASCII; each is one UTF-16 unit, so positions line up with the original. */
const asciiDigits = (text: string) =>
  text.replace(/[०-९]/g, (digit) => String((digit.codePointAt(0) ?? DEVANAGARI_ZERO) - DEVANAGARI_ZERO));

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
/** A number written as money: what comes right before it says rupees. */
const CURRENCY_BEFORE = /(?:₹|\brs\.?|\binr|रु\.?|रुपये)\s*$/i;
const HASHTAG = /#[\p{L}\p{M}\p{N}_]+/gu;

interface NumberToken {
  index: number;
  length: number;
  /** Digits with grouping dropped, as written: "1299", "20", "1299.50". */
  key: string;
  /** The value in paise, had it been rupees. */
  paise: number;
  money: boolean;
}

function numbersIn(text: string): NumberToken[] {
  const normal = asciiDigits(text);
  const out: NumberToken[] = [];
  for (const match of normal.matchAll(NUMBER)) {
    const raw = match[0].replace(/,+$/, "");
    const [whole = "0", fraction = ""] = raw.replace(/,/g, "").split(".");
    const paise = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
    const key = fraction ? `${Number(whole)}.${fraction}` : String(Number(whole));
    out.push({ index: match.index, length: raw.length, key, paise, money: CURRENCY_BEFORE.test(normal.slice(0, match.index)) });
  }
  return out;
}

const effectiveOf = (product: CaptionProductFacts) => product.offerPricePaise ?? product.pricePaise;

/** The prices a caption may state, and the other numbers the facts themselves contain. */
function allowed(facts: CaptionFacts): { prices: Set<number>; plain: Set<string> } {
  const prices = new Set<number>();
  const plain = new Set<string>();
  const words = [facts.shopName];
  for (const product of facts.products) {
    prices.add(product.pricePaise);
    if (product.offerPricePaise !== null && product.offerPricePaise < product.pricePaise) {
      prices.add(product.offerPricePaise);
      // A display percentage, never money: rounded as a shop would say it.
      plain.add(String(Math.round(((product.pricePaise - product.offerPricePaise) * 100) / product.pricePaise)));
    }
    words.push(product.name, product.offerLabel ?? "", product.category ?? "", product.material ?? "");
  }
  for (const word of words) for (const token of numbersIn(word)) plain.add(token.key);
  return { prices, plain };
}

export type CaptionCheck = { ok: true; text: string } | { ok: false; reason: string };

/** D3's post-check: within the limits, and every number one the facts state. */
export function checkCaption(draft: string, facts: CaptionFacts): CaptionCheck {
  const text = draft.trim();
  if (text.length === 0) return { ok: false, reason: "empty" };
  if (text.length > CAPTION_MAX_CHARS) return { ok: false, reason: "too long" };
  if ((text.match(HASHTAG) ?? []).length > CAPTION_MAX_HASHTAGS) return { ok: false, reason: "too many hashtags" };
  const { prices, plain } = allowed(facts);
  for (const token of numbersIn(text)) {
    const fine = prices.has(token.paise) || (!token.money && plain.has(token.key));
    if (!fine) return { ok: false, reason: `number ${token.key} is not in the facts` };
  }
  return { ok: true, text };
}

/** "1,299" or "1,299.50": Indian grouping, paise only when there are some. */
function formatAmount(paise: number): string {
  const whole = Math.floor(paise / 100);
  const fraction = paise % 100;
  const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(whole);
  return fraction === 0 ? grouped : `${grouped}.${String(fraction).padStart(2, "0")}`;
}

export const formatRupees = (paise: number) => `₹${formatAmount(paise)}`;

const NAME_MAX = 80;
const shortName = (name: string) => {
  if (name.length <= NAME_MAX) return name;
  const cut = name.slice(0, NAME_MAX);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).trim();
};

function hashtags(facts: CaptionFacts): string {
  const seen = new Set<string>();
  const tags: string[] = [];
  const sources = [...facts.products.flatMap((p) => [p.category, p.material]), facts.shopName];
  for (const source of sources) {
    // Letters only: a digit in a tag would be a number the check has to explain.
    const tag = (source ?? "").replace(/[^\p{L}\p{M}]+/gu, "");
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(`#${tag}`);
  }
  return tags.slice(0, CAPTION_MAX_HASHTAGS).join(" ");
}

function block(products: CaptionProductFacts[], shopName: string, words: { now: string; was: string; from: (shop: string) => string }): string {
  const lines = products.map((product) => {
    const now = effectiveOf(product);
    const was = now < product.pricePaise ? ` (${words.was} ${formatRupees(product.pricePaise)})` : "";
    const offer = now < product.pricePaise && product.offerLabel ? `, ${product.offerLabel}` : "";
    return `${shortName(product.name)} — ${words.now} ${formatRupees(now)}${was}${offer}`;
  });
  return [...lines, words.from(shopName)].join("\n");
}

/** The caption used when no model wrote one that passed (D3): the facts, plainly, in the chosen language. */
export function templateCaption(facts: CaptionFacts): string {
  const compose = (products: CaptionProductFacts[]) => {
    const { en, hi } = CAPTION_COPY.template;
    const blocks =
      facts.language === CAPTION_LANGUAGE.EN
        ? [block(products, facts.shopName, en)]
        : facts.language === CAPTION_LANGUAGE.HI
          ? [block(products, facts.shopName, hi)]
          : [block(products, facts.shopName, en), block(products, facts.shopName, hi)];
    return [...blocks, hashtags(facts)].filter(Boolean).join("\n\n");
  };
  // As many products as fit; the first ones are the ones the shop put first.
  for (let count = facts.products.length; count > 1; count -= 1) {
    const text = compose(facts.products.slice(0, count));
    if (text.length <= CAPTION_MAX_CHARS) return text;
  }
  return compose(facts.products.slice(0, 1)).slice(0, CAPTION_MAX_CHARS);
}

/**
 * The prices drafts for a post were written with, index-aligned (`CaptionDraft`). Every draft adds
 * its prices rather than replacing the last: the shop may keep an older draft, or add a new one below it.
 */
export interface StatedPrices {
  productIds: string[];
  pricesPaise: number[];
  effectivePricesPaise: number[];
}

export interface LivePrice {
  pricePaise: number;
  effectivePricePaise: number;
}

function entries(stated: StatedPrices): Array<{ productId: string; list: number; effective: number }> {
  return stated.productIds.flatMap((productId, i) => {
    const list = stated.pricesPaise[i];
    const effective = stated.effectivePricesPaise[i];
    return list === undefined || effective === undefined ? [] : [{ productId, list, effective }];
  });
}

function fromEntries(list: Array<{ productId: string; list: number; effective: number }>): StatedPrices {
  const seen = new Set<string>();
  const kept = list.filter((e) => {
    const key = `${e.productId}|${e.list}|${e.effective}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    productIds: kept.map((e) => e.productId),
    pricesPaise: kept.map((e) => e.list),
    effectivePricesPaise: kept.map((e) => e.effective),
  };
}

/** A new draft's prices beside every earlier draft's. */
export function mergeStated(existing: StatedPrices | null, next: StatedPrices): StatedPrices {
  return fromEntries([...(existing ? entries(existing) : []), ...entries(next)]);
}

/** After Update price is saved: the prices it wrote, never a fresh read that may have moved since. */
export function restated(recorded: StatedPrices, changes: readonly CaptionPriceChangeDto[]): StatedPrices {
  const swap = (productId: string, paise: number) =>
    changes.find((c) => c.productId === productId && c.wasPaise === paise)?.nowPaise ?? paise;
  return fromEntries(entries(recorded).map((e) => ({ ...e, list: swap(e.productId, e.list), effective: swap(e.productId, e.effective) })));
}

/**
 * Each drafted price a product no longer has (D4). A product gone from the shop is not a change.
 * Not rewritable when swapping the number would leave a false claim: the offer itself ended, or the
 * old amount is also a price some product has today, which a swap by amount would corrupt.
 */
export function priceChangesBetween(recorded: StatedPrices, live: ReadonlyMap<string, LivePrice>): CaptionPriceChangeDto[] {
  const today = new Set([...live.values()].flatMap((p) => [p.pricePaise, p.effectivePricePaise]));
  const changes: CaptionPriceChangeDto[] = [];
  const add = (productId: string, wasPaise: number, nowPaise: number, offerEnded: boolean) => {
    if (changes.some((c) => c.productId === productId && c.wasPaise === wasPaise)) return;
    changes.push({ productId, wasPaise, nowPaise, rewritable: !offerEnded && !today.has(wasPaise) });
  };
  for (const e of entries(recorded)) {
    const now = live.get(e.productId);
    if (!now) continue;
    const offerEnded = e.effective < e.list && now.effectivePricePaise >= now.pricePaise;
    if (now.effectivePricePaise !== e.effective) add(e.productId, e.effective, now.effectivePricePaise, offerEnded);
    if (e.list !== e.effective && now.pricePaise !== e.list) add(e.productId, e.list, now.pricePaise, offerEnded);
  }
  return changes;
}

/** Whether the caption still states this amount, however it is grouped or written. */
export function statesPrice(caption: string, paise: number): boolean {
  return numbersIn(caption).some((token) => token.paise === paise);
}

/** Update price (D4): each stated old price becomes the new one; no other character moves. */
export function rewritePrices(caption: string, changes: readonly CaptionPriceChangeDto[]): string {
  let out = caption;
  // From the end, so earlier positions stay valid as lengths change.
  for (const token of numbersIn(caption).reverse()) {
    const change = changes.find((c) => c.wasPaise === token.paise);
    if (!change) continue;
    out = out.slice(0, token.index) + formatAmount(change.nowPaise) + out.slice(token.index + token.length);
  }
  return out;
}
