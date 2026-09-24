// Images reach the browser through next/image, at the size the slot actually uses.
//
// This suite exists because the free tier's 10GB Blob transfer allowance was exhausted
// pre-launch, and every contributing cause was a styling-invisible one: a raw <img> on
// the product tile, `unoptimized` added to the gallery and lightbox, and no `sizes` to
// say how small the slot really is. All three look correct on screen — the only symptom
// is a bill, or on the free tier, images silently going blank. ADR-0026.
//
// Allowlists are for a third party's host or a local blob:/data: preview — never for
// "it was easier".
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** A raw <img> goes straight to Blob at full size: no resize, no format negotiation. */
const RAW_IMG = /<img[\s>]/g;
/** `unoptimized` hands the original to the browser, whatever `sizes` claims. */
const BYPASS = /\bunoptimized\b/g;

const RULES = [
  {
    name: "raw <img> elements",
    pattern: RAW_IMG,
    fix: "use next/image, or allowlist the file with the reason it cannot",
  },
  {
    name: "optimization bypasses",
    pattern: BYPASS,
    fix: "drop `unoptimized` — it serves the full original from Blob",
  },
] as const;

// file -> the rules it is excused from, and why.
const ALLOWLIST: Record<string, { rules: readonly string[]; reason: string }> = {
  "src/app/(main)/bid/[slug]/opengraph-image.tsx": {
    rules: ["raw <img> elements"],
    reason:
      "ImageResponse renders through Satori, which implements a small subset of HTML and does not know next/image. It runs server-side per OG render, so no browser fetches this.",
  },
  "src/components/shared/image-upload.tsx": {
    rules: ["raw <img> elements"],
    reason:
      "Previews the file still held in the page as a blob: URL, which next/image cannot take — and which costs no egress precisely because it is not fetched from Blob.",
  },
  "src/components/product/product-media-manager.tsx": {
    rules: ["raw <img> elements", "optimization bypasses"],
    reason:
      "Same local blob: preview as image-upload.tsx; the bypass is conditional on a YouTube poster, whose host is not ours to optimize.",
  },
  "src/components/profile/profile-pic-upload.tsx": {
    rules: ["raw <img> elements"],
    reason:
      "The just-picked avatar is a local data: URL from FileReader. The saved picture next to it goes through next/image.",
  },
  "src/components/shipping/providers-console/component/ProviderCard.tsx": {
    rules: ["optimization bypasses"],
    reason:
      "A carrier's own logo, hotlinked from shiprocket.in by a data migration. Already sized at 32px and not our asset: optimizing spends a transformation to save bytes we do not pay for.",
  },
  "src/components/product/youtube-embed.tsx": {
    rules: ["optimization bypasses"],
    reason:
      "i.ytimg.com serves its own already-sized poster frames: optimizing spends a transformation to save nothing, and none of those bytes are our Blob egress.",
  },
  "src/components/shared/forms/product/index.tsx": {
    rules: ["optimization bypasses"],
    reason:
      "Bypass is conditional on the item being a YouTube poster; photographs on the same surface are optimized.",
  },
};

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const FILES = sourceFiles("src");

describe("images are delivered through the optimizer", () => {
  it.each(RULES)("has no $name outside the allowlist", ({ name, pattern, fix }) => {
    const offenders: string[] = [];
    for (const file of FILES) {
      if (ALLOWLIST[file]?.rules.includes(name)) continue;
      if (readFileSync(file, "utf8").match(pattern)) offenders.push(`${file} — ${fix}`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist honest: entries must still contain what they excuse", () => {
    for (const [file, { rules, reason }] of Object.entries(ALLOWLIST)) {
      expect(reason.length).toBeGreaterThan(30);
      const source = readFileSync(file, "utf8");
      for (const name of rules) {
        const rule = RULES.find((r) => r.name === name);
        expect(rule, `unknown rule "${name}" in allowlist`).toBeDefined();
        expect(
          source.match(rule!.pattern),
          `${file} no longer needs its "${name}" exemption`
        ).not.toBeNull();
      }
    }
  });
});

// `fill` with no `sizes` resolves to 100vw: a 64px avatar then downloads the width of
// the viewport. It is the same overrun as a raw <img>, wearing next/image's clothes.
describe("every filled Image states the size of its slot", () => {
  it("has no <Image fill> without sizes", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = readFileSync(file, "utf8");
      for (const [index, chunk] of source.split(/<Image[\s]/).entries()) {
        if (index === 0) continue;
        // The opening tag ends at the first `>` — enough to read its props.
        const tag = chunk.slice(0, chunk.indexOf(">"));
        if (/\bfill\b/.test(tag) && !/\bsizes=/.test(tag)) {
          offenders.push(`${file} — <Image fill> with no sizes`);
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});

// The 4-hour default would otherwise apply silently. Blob paths are timestamped, so a
// URL's bytes never change and a long TTL can never serve something stale.
describe("the optimizer cache TTL is stated, not defaulted", () => {
  it("sets minimumCacheTTL in next.config.ts", () => {
    expect(readFileSync("next.config.ts", "utf8")).toMatch(/minimumCacheTTL:\s*\d+/);
  });
});

// The stored ceiling and the zoom cap are one decision in two numbers: a surface that
// magnifies 3x needs three times its box in real pixels, and a zoom raised without
// raising the ceiling goes soft with no error anywhere. Pinned here because the first
// version of ADR-0026 shipped a 1600px ceiling against a 3x zoom and measured twice the
// error of 2000px at full magnification (ADR-0027).
describe("the stored ceiling covers what the zoom asks for", () => {
  it("declares the zoom cap once, and derives the zoomable sizes from it", async () => {
    const { MAX_ZOOM_SCALE, ZOOMABLE_IMAGE_SIZES, MAX_IMAGE_EDGE } = await import(
      "../../server/catalog/media"
    );
    expect(MAX_ZOOM_SCALE).toBeGreaterThan(1);
    // Declared as a multiple of the zoom rather than a literal, so the two move together.
    expect(ZOOMABLE_IMAGE_SIZES).toBe(`${Math.min(MAX_ZOOM_SCALE, 2) * 100}vw`);

    // A 3:4 photograph in a 1440x900 lightbox is height-bound at ~675px wide; at full
    // zoom it wants that many pixels times the scale.
    const widestDisplayedEdge = 900 * (3 / 4);
    expect(MAX_IMAGE_EDGE).toBeGreaterThanOrEqual(widestDisplayedEdge * MAX_ZOOM_SCALE);
  });

  it("has no second spelling of the zoom cap in the components that zoom", () => {
    for (const file of [
      "src/components/shared/image-lightbox.tsx",
      "src/components/product/product-gallery.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, `${file} imports the shared cap`).toContain("MAX_ZOOM_SCALE");
      // `Math.min(3,` / `MAX_SCALE = 3` are how the drift started.
      expect(source).not.toMatch(/Math\.min\(\s*3\s*,|MAX_SCALE\s*=\s*3\b/);
    }
  });
});

/**
 * The upload side of the same allowance.
 *
 * A presigned PUT is permission to write bytes directly to R2 ([ADR-0028]), so the browser —
 * not the server — decides what those bytes are. The route signs the path, the content type
 * and the exact size, but it cannot make a 12MP phone photo smaller. Only the caller can, by
 * running `downscaleImage` first ([ADR-0026]).
 *
 * All four callers do today. Nothing stopped a fifth from not doing, which is how the stored
 * ceiling gets quietly reopened: an original upload costs storage for ever and forces the
 * optimizer to transform a huge source on first request.
 */
describe("a browser upload is downscaled before it is stored", () => {
  const DIRECT_UPLOADERS = FILES.filter((f) => /\buploadDirect\b/.test(readFileSync(f, "utf8")))
    .filter((f) => !f.endsWith("upload-direct.ts")); // the helper itself

  it("finds the callers it means to check", () => {
    // If this scan ever finds nothing, the assertion below is vacuous rather than passing.
    expect(DIRECT_UPLOADERS.length, "no uploadDirect callers found").toBeGreaterThan(2);
  });

  it.each(DIRECT_UPLOADERS)("%s downscales first", (file) => {
    const source = readFileSync(file, "utf8");
    expect(
      /downscaleImage/.test(source),
      `${file} uploads straight to the object store without calling downscaleImage. A presigned ` +
        "PUT writes whatever the browser hands it, so the original — often 10MB from a phone — " +
        "is what gets stored and what the optimizer then has to transform (ADR-0026).",
    ).toBe(true);
  });
});
