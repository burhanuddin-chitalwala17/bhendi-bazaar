# ADR-0075: Photographs are stored at each delivery width and served without an optimizer

- **Date:** 2026-11-20
- **Status:** Accepted. Amends [ADR-0026](0026-images-are-delivered-through-the-optimizer.md) (delivery through the optimizer, D6) and [ADR-0028](0028-images-live-in-cloudflare-r2.md) (the optimizer as R2's resizer)
- **Context:** On 2026-11-20 every product image on bhendi-bazaar.com came back `402 Payment Required` from `/_next/image`: the Vercel Hobby image-optimization quota (5,000 transformations a month) was spent. ADR-0026 had named this as "a second meter to watch, and the first place to look if images break again". The meter does exactly what ADR-0028 left R2 to escape: on the free tier it does not bill, it switches images off. Since ADR-0026 D4, every stored photograph is already capped at `MAX_IMAGE_EDGE` and re-encoded as WebP, so the optimizer's only remaining job was making the smaller sizes for tiles and phones. The owner declined Vercel Pro (ADR-0028), and declined Cloudflare Image Transformations (free to 5,000 unique a month, then $0.50 per 1,000, recounted every month) for the same reason: it is the same kind of meter on another vendor.
- **Decision:**
  1. **Every raster photograph is also stored at each `DELIVERY_WIDTHS` (320, 800, 1200), as WebP, beside its original:** `a/b.webp` gets `a/b.w320.webp` and so on (`server/catalog/image-widths.ts`). Copies are never enlarged. The database keeps the original's URL only; a copy's name is derived from it.
  2. **The copies are written by the object store, so no caller can forget them.** `putObject` writes them with any image. Bytes a browser PUT directly get them before they are usable: `mediaAssetService.confirmUpload` for the library and wizards, and `reviewService` when a review cites its photos (`ensureWidthCopies`). `deleteObject` removes them with the original.
  3. **A custom `next/image` loader replaces the optimizer** (`src/lib/image/loader.ts`). For one of our photographs it returns the smallest copy at least as wide as asked, or the original above 1200. Anything else is returned unchanged. `deviceSizes` is exactly the copies plus the 2048 ceiling and `imageSizes` is empty, so a srcset never names a width that has no file. The browser still chooses from `sizes`, which ADR-0026 D3 keeps mandatory.
  4. **History is backfilled around the deploy:** `scripts/backfill-image-widths.ts --write` lists the bucket and writes missing copies. It only adds objects. It runs once before the loader deploys and once after, to catch anything the old code stored in between.
- **Alternatives considered:**
  - *Vercel Pro.* Declined by the owner in ADR-0028. It turns the outage into an open-ended bill.
  - *Cloudflare Image Transformations on the R2 domain.* One loader line and no backfill, but a capped free tier that fails with error 9422, then a per-transformation charge recounted every month.
  - *`images.unoptimized: true` alone.* No cost and no backfill, but every tile downloads the full ~150 KB original: a listing goes from ~120 KB to ~1.8 MB on a phone. Kept as the emergency fallback, not the design.
  - *Store derivatives as columns (`thumbnailUrl`).* ADR-0026 rejected this for Blob's 1 GB storage cap and the schema change. Names derived from the original avoid the schema change, and R2's 10 GB removes the storage objection (the copies add about 40%).
  - *Generate copies lazily on first request.* That is an optimizer again, run in our functions, and it puts our code on the read path ADR-0028 D3 keeps out.
- **Consequences:**
  - ✅ No meter can switch images off. R2 has no egress charge, and the copies are written once.
  - ✅ A tile still downloads ~10 KB rather than the original.
  - ⚠️ Every image write is three extra objects and ~300 ms of sharp. Uploads are a little slower, and storage is ~40% larger.
  - ⚠️ A photograph without copies renders broken, because the loader cannot tell. Hence D2 is in the store and D4 runs around the deploy. A review photo's copies are made at submit, so its picker shows the original until then. `tests/unit/image-widths.test.ts` pins the names on both sides.
  - ⚠️ Only three widths, chosen ahead of time. A slot between them gets the next size up, at most ~2.5× its pixels.
  - ⚠️ A canvas reading a stored image now reads a cross-origin URL, so the bucket's CORS rules must allow GET from our origin (the fit-it-in edge colour falls back to none without it).
  - ⚠️ Sign-in avatars and other third-party images are now fetched by the browser itself, so their hosts must be in the CSP `img-src` (`lh3.googleusercontent.com` added).
