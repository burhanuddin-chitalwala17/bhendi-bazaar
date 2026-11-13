/** The heading-face picker's words (storefront-look ux.md: Look and Font sheet, copy deck). */
export const FONT_COPY = {
  row: "Font for headings",
  templateDefault: "Template default",
  title: "Font for headings",
  help: "Your shop name, headings and product names use this font. Sizes stay the same.",
  suggestedFor: (template: string) => `Suggested for ${template}`,
  more: "More fonts",
  useDefault: "Use template default",
  publishTitle: (template: string, face: string) => `Publish ${template} with ${face}?`,
  published: (face: string) => `Published. Your store now uses ${face}.`,
  previewing: "Previewing · not live yet",
} as const;

/** ux.md Long content: a sample shows this much of the shop's name. */
export const SAMPLE_NAME_MAX = 24;

export const sampleName = (name: string) =>
  name.length > SAMPLE_NAME_MAX ? `${name.slice(0, SAMPLE_NAME_MAX).trimEnd()}…` : name;
