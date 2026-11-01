/**
 * Typed words against a listed set (own-store/bulk-sheet D6, Q8): a pasted or typed value still
 * finds its listed value whatever its case, spacing or punctuation, and a miss names the closest.
 */

/** What is left of a word once case, spaces and punctuation are gone. */
export function normaliseWord(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** Edit distance counting a swapped pair as one edit — "Yse" is one slip from "Yes", not two. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

export interface WordEntry<T> {
  value: T;
  /** What the dropdown shows, and what a miss suggests. */
  label: string;
  /** Every word that names this value: the label, its key, a slug. */
  words: readonly string[];
}

export interface WordMatcher<T> {
  match(text: string): T | undefined;
  /** The listed label nearest a miss, or nothing when no label is near enough to be a slip. */
  closest(text: string): string | undefined;
}

const AMBIGUOUS = Symbol("ambiguous");

/**
 * Exact (case aside) first, then with spacing and punctuation gone. A normalised word two values
 * share matches neither, so "Women Abayas" cannot land on "Women › Abayas" by luck.
 */
export function wordMatcher<T>(entries: readonly WordEntry<T>[]): WordMatcher<T> {
  const exact = new Map<string, T | typeof AMBIGUOUS>();
  const loose = new Map<string, T | typeof AMBIGUOUS>();
  const put = (map: Map<string, T | typeof AMBIGUOUS>, word: string, value: T) => {
    if (!word) return;
    const seen = map.get(word);
    map.set(word, seen === undefined || seen === value ? value : AMBIGUOUS);
  };
  for (const entry of entries) {
    for (const word of entry.words) {
      put(exact, word.trim().toLowerCase(), entry.value);
      put(loose, normaliseWord(word), entry.value);
    }
  }
  const found = (hit: T | typeof AMBIGUOUS | undefined) => (hit === AMBIGUOUS ? undefined : hit);

  return {
    match(text) {
      const trimmed = text.trim().toLowerCase();
      if (!trimmed) return undefined;
      return found(exact.get(trimmed)) ?? found(loose.get(normaliseWord(text)));
    },
    closest(text) {
      const typed = normaliseWord(text);
      if (!typed) return undefined;
      let best: { label: string; distance: number } | undefined;
      for (const entry of entries) {
        const label = normaliseWord(entry.label);
        const distance = editDistance(typed, label);
        // A third of the longer word: "Emrald" finds "Emerald"; "Silk" does not find "Gold".
        const allowed = Math.max(1, Math.floor(Math.max(typed.length, label.length) / 3));
        if (distance <= allowed && (!best || distance < best.distance)) best = { label: entry.label, distance };
      }
      return best?.label;
    },
  };
}

/** The ux.md problem line for a value outside its list, with the nearest listed one when there is one. */
export function notInListMessage(column: string, value: string, closest: string | undefined): string {
  const line = `${column} '${value}' isn't in the list — pick from the dropdown`;
  return closest ? `${line}. Did you mean '${closest}'?` : line;
}

export const YES = "Yes";
export const NO = "No";

/** Yes/no as the dropdown offers it, and the spellings a pasted answer arrives in. */
export const YES_NO: readonly WordEntry<boolean>[] = [
  { value: true, label: YES, words: [YES, "y", "true", "1"] },
  { value: false, label: NO, words: [NO, "n", "false", "0"] },
];
