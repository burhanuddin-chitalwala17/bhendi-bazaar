/**
 * `cn` resolves this project's own tokens (ADR-0022).
 *
 * `tailwind-merge` only de-duplicates classes it can assign to a group. It knows
 * nothing about `rounded-card`, `max-h-overlay` or `text-2xs`, so before `cn` was
 * taught them an override kept *both* classes and the stylesheet's order silently
 * decided the winner. The image lightbox is what found it: `max-h-none rounded-none`
 * over the dialog's `max-h-overlay rounded-card` left the cap in place, so a full-screen
 * viewer was neither full height nor square-cornered.
 *
 * A token added to `globals.css` and not to `cn` still renders — it just stops being
 * overridable. That is the failure this file exists to catch.
 */
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

const classes = (value: string) => value.split(" ").filter(Boolean);

describe("cn resolves custom tokens", () => {
  it.each([
    ["rounded-card", "rounded-none"],
    ["rounded-field", "rounded-full"],
    ["max-h-overlay", "max-h-none"],
    ["shadow-raised", "shadow-none"],
    ["shadow-lifted", "shadow-overlay"],
    ["shadow-inset-field", "shadow-none"],
    ["text-2xs", "text-sm"],
    ["text-display", "text-3xl"],
    ["text-small", "text-base"],
    ["text-caption", "text-lg"],
    ["text-label", "text-sm"],
    ["duration-fast", "duration-500"],
    ["ease-standard", "ease-in"],
    ["tracking-eyebrow", "tracking-normal"],
    ["tracking-eyebrow-wide", "tracking-tight"],
    ["tracking-label", "tracking-wide"],
    ["tracking-display", "tracking-normal"],
    ["h-tabbar", "h-full"],
    ["pb-safe", "pb-0"],
    ["pb-tabbar", "pb-4"],
    ["bottom-tabbar", "bottom-0"],
    // storefront-themes D2, D3
    ["shadow-tile", "shadow-none"],
    ["text-headline", "text-sm"],
    ["text-title", "text-lg"],
    ["text-body", "text-xs"],
    ["text-tag", "text-base"],
    ["text-price", "text-xl"],
    ["tracking-headline", "tracking-normal"],
    ["tracking-tag", "tracking-wide"],
    ["font-display", "font-sans"],
    ["font-label", "font-mono"],
    ["text-deal-foreground", "text-foreground"],
    ["text-on-photo", "text-primary"],
    ["bg-deal", "bg-card"],
    ["bg-feature", "bg-muted"],
    ["bg-photo-scrim", "bg-transparent"],
    ["max-w-store", "max-w-none"],
    ["py-section", "py-0"],
    ["px-gutter", "px-4"],
    ["gap-grid", "gap-2"],
    ["duration-theme", "duration-0"],
    ["ease-theme", "ease-linear"],
    // storefront-themes Q17
    ["bg-theme-pattern", "bg-none"],
  ])("%s is dropped when %s overrides it", (token, override) => {
    expect(classes(cn(token, override))).toEqual([override]);
  });

  it("keeps a token that nothing overrides", () => {
    expect(classes(cn("rounded-card p-2"))).toContain("rounded-card");
  });

  it("collapses the dialog classes the lightbox overrides", () => {
    // The real pair, in the real order: the base DialogContent, then the lightbox.
    const out = classes(
      cn(
        "max-h-overlay w-full max-w-[calc(100%-2rem)] rounded-card border p-6 shadow-overlay",
        "max-h-none w-screen max-w-none rounded-none border-0 p-0 shadow-none",
      ),
    );
    for (const dropped of [
      "max-h-overlay",
      "rounded-card",
      "shadow-overlay",
      "w-full",
      "max-w-[calc(100%-2rem)]",
      "border",
      "p-6",
    ]) {
      expect(out, `${dropped} should have been overridden`).not.toContain(dropped);
    }
  });
});
