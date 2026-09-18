# Brand assets

Ship with the app rather than living in object storage ([ADR-0028](../../docs/adr/0028-images-live-in-cloudflare-r2.md)). They change on a rebrand, not on an upload, and keeping them here means a storage outage cannot take the site's own logo down — which is exactly what happened when they lived in Vercel Blob.

| File | Used by | Current |
|---|---|---|
| `bhendi-bazaar.png` | navbar logo, favicon, PWA icons (`LOGO`, `FAVICON`) | 500×500 PNG with alpha |
| `og-image.jpeg` | link previews (`OG_IMAGE`) | 1536×1024, 3:2 |

**Filenames and dimensions are referenced from `src/lib/config.ts`** — change one and change the other. `OG_IMAGE_SIZE` must match the file's real pixels: a declared size that disagrees with the bytes makes scrapers crop the card wrong.

The OG image is 3:2 where WhatsApp, Facebook and Slack prefer 1.91:1, so expect some top/bottom crop in shares. Re-cutting to 1200×630 would remove it; update `OG_IMAGE_SIZE` in the same change if you do. It must stay a raster — those platforms render no SVG.

Paths are root-relative; `metadataBase` in `app/layout.tsx` makes them absolute where a scraper needs them.
