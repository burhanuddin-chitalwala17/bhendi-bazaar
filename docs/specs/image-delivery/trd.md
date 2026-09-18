# TRD — image delivery

- **Status:** ✅ Implemented — PR-105
- **Verified:** 2026-09-16
- **Spec:** [spec.md](spec.md)
- **Decision record:** [ADR-0026](../../adr/0026-images-are-delivered-through-the-optimizer.md)

> Technical approach. No code — references by path ([ADR-0009](../../adr/0009-docs-reference-code-never-copy-it.md)).

## Approach
Two independent ceilings, because each covers the other's failure. **Delivery**: every image renders through `next/image`, which negotiates format and size per request from the `sizes` the slot declares. **Storage**: photographs are downscaled and re-encoded before they reach Blob, so even a delivery mistake costs a fraction of what it used to. Neither alone is sufficient — see D2.

## Decisions

**D1 — `next/image` everywhere in `src/`, with two named exceptions.** A raw `<img>` survives only where the bytes are local (`blob:`/`data:` previews, which cost no egress and which `next/image` rejects) or where the renderer cannot take it — `ImageResponse` goes through Satori. Both are allowlisted with reasons in `tests/unit/image-delivery.test.ts`. (R1, R9)

**D2 — Storage is capped as well as delivery, and neither is trusted alone.** Fixing only delivery leaves the optimizer as the one thing between a 5 MB original and the browser, so one missed `sizes` reopens the leak. Fixing only storage caps the damage and then makes every future `<img>` look harmless. Rejected both as partial. (R1, R2, H4)

**D3 — The size budget lives in `server/catalog/media.ts`, not in the upload service.** `MAX_IMAGE_EDGE` (1600px) and `IMAGE_QUALITY` are imported by both enforcement points. `media.ts` was already the module both the server and the client components import, so this needs no new neutral module. (H1)

**D4 — Each upload path normalises with what it has.** The server routes reach `normalizeImage` in `server/catalog/image-upload.ts` (sharp: `rotate()` for EXIF, `fit: "inside"`, `withoutEnlargement`, WebP). The bulk wizards call `downscaleImage` in `src/lib/image/downscale.ts` (canvas + `toBlob`) *before* `upload()`, because those bytes go browser-to-Blob and no server code ever sees them ([bulk-catalog-upload](../bulk-catalog-upload/) D10). Same constants, different mechanism. (R3, H1)

**D5 — Normalisation degrades rather than refuses.** `downscaleImage` returns the original file when the image cannot be decoded, is already within budget, or re-encodes larger — a bulk run failing a whole sheet over one odd file is worse than storing that one as picked. `normalizeImage` is stricter because it is one file at a time and can report: an undecodable file raises `DomainError`, which reaches the user as a message rather than a 500. (R4)

**D6 — The stored pathname follows the bytes.** Re-encoding to WebP makes the picked extension a lie. `normalizedName` and `storedPathFor` swap it. `buildImagePath` is untouched — it is pinned by tests and its shape is a documented convention. (R5)

**D7 — Nothing is backfilled.** Existing Blob objects keep their URLs and their original bytes. The optimizer means they no longer cost full size to *serve*, so what remains is a storage cost, not a transfer one. A rewrite would break `Product.thumbnail` and `ProductMedia.ref` for no transfer saving. Note for anyone reading storage figures later: they are pre-2026-09-16 originals. (R5, H7)

**D8 — `sizes` is required wherever `fill` is used, and enforced separately.** Absent `sizes` resolves to `100vw`, so this is the original defect in a new disguise and would not be caught by a rule that only bans `<img>`. The test parses each `<Image` opening tag. (H2)

**D9 — The honesty of a `sizes` value is a review question, not a test.** No static check can tell that `sizes="100vw"` on a `size-16` box is wrong. Named explicitly in the `/bb-review` skill instead, alongside the allowlist-entry judgement. (H3)

**D10 — The product tile's `sizes` is declared once.** `PRODUCT_TILE_SIZES`, exported from `src/components/shared/product-card.tsx` and used by `wishlist-grid.tsx`, mirrors `PRODUCT_GRID_CLASSES`. It lives with the tile rather than in `product-grid.tsx` because `product-grid` imports the card, and the reverse would be a cycle. (H3)

**D11 — Previews render the file already in the page.** `useLocalPreviews` (`src/hooks/core/useLocalPreviews.ts`) keys an object URL by the URL the upload returned, so a caller holding only the URL can still ask for the local copy; it revokes on unmount rather than per removed item, since a list can drop and restore a URL while mounted. `profile-pic-upload.tsx` already had a `FileReader` preview and only needed its saved-picture branch split out. (R6)

**D12 — `images.minimumCacheTTL` is stated, not defaulted.** Next 16 defaults to 4 hours. `put()` already sends a one-month `max-age` and the optimizer honours the longer of the two, so this changes no behaviour today — it states the intent so a future upstream change cannot quietly shorten it. Safe because `buildImagePath` timestamps every path: a URL's bytes never change. (H5)

**D13 — sharp is declared, not borrowed.** It was already present as a Next transitive dependency; relying on that would pin us to whatever Next resolves. Declaring it means the upload routes must stay on the Node.js runtime — noted in [DEPENDENCIES.md](../../DEPENDENCIES.md) because it is a real constraint, not a footnote.

**D14 — Enforcement mirrors the design-token suite.** `tests/unit/image-delivery.test.ts` follows `design-tokens.test.ts`: a failure naming the file, an allowlist demanding a reason, and an honesty check that fails when an exemption is no longer needed. Chosen over an ESLint rule because the repo *already had* `@next/next/no-img-element` and every offending site carried a disable comment — a mechanism that silences without recording why. (R8, H4)

**D15 — Both meters are in the runbook.** [OPERATIONS.md](../../OPERATIONS.md) records what Data Transfer measures, that the free tier withdraws rather than bills, that the reset is the billing anniversary, that local development draws on the same meter, and that image optimization is a second quota to check if images break while transfer looks healthy. (R10, H5, H6)

## Testing
`tests/unit/image-delivery.test.ts` — the three delivery rules, the allowlist honesty check, and the config assertion. `tests/unit/image-upload.test.ts` — `normalizeImage` caps the long edge, re-encodes to WebP, does not enlarge a small image, and reports an undecodable file as a `DomainError`. `tests/unit/image-downscale.test.ts` — `storedPathFor` across the extension cases. `downscaleImage` itself is not unit-tested: it needs `createImageBitmap` and a canvas, neither of which jsdom provides, and D5 makes its failure mode "upload the original".

## Out of scope
Backfilling existing Blob objects (D7). Responsive `<picture>` art direction — the optimizer's format negotiation covers what we need. Serving from a CDN in front of Blob: the optimizer's cache already is one, and a second layer would add a second thing to invalidate.
