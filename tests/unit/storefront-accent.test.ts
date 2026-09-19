/**
 * A shop's accent reaches the page (storefront-branding R2, ADR-0030 decision 8).
 *
 * Written because it did not. The field existed, the editor saved it, the DAL carried
 * it, and nothing rendered it — a setting an org could change with no visible effect.
 * Nothing failed, because a value that is stored and ignored looks exactly like a
 * value that works.
 *
 * So this pins the two halves that have to agree: every accent the schema offers has a
 * scope in globals.css, and every scope changes something.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { STOREFRONT_ACCENTS } from "@/lib/validation/schemas/storefront.schema";

const CSS = readFileSync("src/app/globals.css", "utf8");
const WRAPPER = readFileSync("src/components/storefront/storefront-theme.tsx", "utf8");

describe("an accent an org can pick is an accent the page honours", () => {
  it("offers a closed set, never a colour value", () => {
    // ADR-0022: an org names a token; it cannot express a colour the system
    // does not already own.
    expect(STOREFRONT_ACCENTS.length).toBeGreaterThan(0);
    for (const accent of STOREFRONT_ACCENTS) {
      expect(accent).toMatch(/^[a-z]+$/);
    }
  });

  it.each(STOREFRONT_ACCENTS.filter((a) => a !== "primary"))(
    "%s has a scope in globals.css",
    (accent) => {
      expect(CSS).toContain(`.storefront[data-accent="${accent}"]`);
    }
  );

  it.each(STOREFRONT_ACCENTS.filter((a) => a !== "primary"))(
    "%s repoints --primary at a token that exists",
    (accent) => {
      const block = CSS.split(`.storefront[data-accent="${accent}"]`)[1]?.split("}")[0];
      expect(block, `no rule body for ${accent}`).toBeDefined();
      expect(block).toContain("--primary:");
      // Points at a declared token rather than a fresh oklch value, so dark mode
      // follows with no second block to keep in step.
      expect(block).toMatch(/--primary:\s*var\(--[a-z-]+\)/);
      expect(CSS).toMatch(new RegExp(`--${accent}:`));
    }
  );

  it("defaults to the platform's primary rather than a special case", () => {
    // `primary` needs no scope: absent the attribute, the shop inherits it.
    expect(CSS).not.toContain('.storefront[data-accent="primary"]');
  });

  it("puts the accent on a data attribute, never an inline style", () => {
    expect(WRAPPER).toContain('data-accent=');
    expect(WRAPPER).not.toMatch(/style=\{\{/);
  });

  it("scopes it to the shop's own content, not the platform chrome", () => {
    // The navbar, tab bar and footer are the platform's whatever a shop picks, so the
    // scope must be a wrapper inside the layout rather than the layout itself.
    const layout = readFileSync("src/app/(store)/store/layout.tsx", "utf8");
    expect(layout).not.toContain("data-accent");
  });
});
