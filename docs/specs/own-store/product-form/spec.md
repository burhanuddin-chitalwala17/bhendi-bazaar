# Spec — own-store/product-form

- **Summary:** A shop lists or changes a product on its phone in five short steps, sees what each place it sells on will still ask while it fills, and can let the Bhendi Bazaar team fix a product for it, every change on record
- **Status:** Implemented — 2026-11-01, units 1–6
- **Domain:** catalog, with listing (readiness) and shared (audit)
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-30
- **References:** [decisions.md](decisions.md), `431ed6e7:docs/specs/own-store/product-form/ux.md`, [own-store](../spec.md) (Q13, Q16, Q17), bulk-sheet (`planning-archive-2026-11-25:docs/specs/own-store/bulk-sheet/`) (sibling), [copy-product](../../copy-product/), [listing-vocabulary](../../listing-vocabulary/), [ADR-0021](../../../adr/0021-audit-trail-never-fails-the-action.md), [ADR-0029](../../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. The technical approach was trd.md, removed once shipped (ADR-0073): `git show 431ed6e7:docs/specs/own-store/product-form/trd.md`.

## What this feature is
Vertical 3 of own-store. The product form becomes five short steps on a phone — Photos and video,
What it is, Price & stock, Details, Review — for both new and existing products. Editing opens at an
overview of those sections. The platform admin can open the same form for a shop.

## Why
Today every field sits on one long page: no steps, no progress, errors at the top and bottom,
and what a marketplace will still ask shows only after saving. The seller is not tech-savvy and
lists from a phone in the shop. The bar is the owner's father's own number: one Amazon listing
takes him 5–10 minutes, so a full product here, with three photos, must take five or fewer. Sellers
will also ask the team for help, and today the admin can only look (own-store Q17).

## Hazards this feature must close
- **Silent swap.** Changing the category changes the product type; today its answers vanish
  without a word (`ProductFactFields`).
- **Lost work.** Edit has no unsaved-changes warning and no draft; a back tap loses everything.
- **Draft over copy.** A restored device draft must never overwrite a "copy from" start.
- **Two editors.** The shop and the admin can edit the same product at once; the later save must
  not silently undo the earlier one. Stock is already compare-and-set; other fields are not.
- **Hidden errors.** A field with an error on a step the seller is not looking at must still be
  found, or the save "does nothing".
- **Unrecorded help.** An admin change that the shop cannot see or trace breaks trust.
- **Video lost in the steps.** The gallery editor today takes photos, a phone video and a YouTube
  link (`src/components/product/product-media-manager.tsx`); a step built for photos must not drop
  either kind of video, the cover rule, or the processing state.
- **Late refusal.** A video's length is known only after the worker reads it, so a too-long video
  fails after upload, and the reason sits on the video in the library, not on the row.

## Requirements
- **R1** — New product is five steps, one screen each, with a progress bar and step chips the
  seller can jump between. Each step asks only what it needs (own-store "ask at the point of need").
- **R2** — Seldom-used fields (SKU, tags, flags, low-stock alert, family) sit under "More options"
  in the step they belong to, closed by default.
- **R3** — Review shows the whole product as a buyer will see it, and every problem as a line
  that opens its step. "Put on sale" saves and the product is live (own-store Q16).
- **R4** — Errors show only beside their field; the step chip shows a count. No banners at the
  top and bottom.
- **R5** — While filling, each step shows what the places this shop sells on will still ask, in
  plain words. It never blocks, disables or delays saving (ADR-0053). A shop selling nowhere else
  sees nothing.
- **R6** — Changing the category names which answers will not carry over before it happens; the
  seller may keep the old category. Answers are kept until save in case they switch back.
- **R7** — Editing opens at an overview: one card per section with a summary and its hints. A
  card opens that section alone; one "Save changes" saves the product.
- **R8** — Typed work survives: a device draft on create and edit, and a "Leave without saving?"
  sheet when leaving with changes.
- **R9** — A save over a product changed by someone else since it was opened is refused, names
  who and when, and reopens the latest with the seller's own changes re-applied for review.
- **R10** — The platform admin can add a product for a shop and edit any shop product, in the same
  form, with a banner naming the shop and a one-line reason (Q22).
- **R11** — Every admin create or edit is recorded: who, when, the reason, each field before and
  after. A failed record never fails the save (ADR-0021).
- **R12** — The shop sees "Edited by Bhendi Bazaar team" on the product and its list row, and a
  history line of what changed (own-store Q17, Q23).
- **R13** — No button is disabled; an action that cannot run says why on tap.
- **R14** — The first step is "Photos and video" and keeps what the gallery editor does today: one
  picker takes photos and a phone video together; a video goes up as picked (MP4, MOV or WebM, at
  most 90 seconds and 200 MB, `server/catalog/video.ts`) and the worker makes it playable; a
  YouTube link can be pasted; at most 10 items (`MAX_MEDIA_PER_PRODUCT`).
- **R15** — The cover is always a photo the seller taps "Cover" on; nothing picks one for them and
  a video never offers it (product-video R12, R15). A video is an extra, never a named slot, and
  sits where the seller moves it.
- **R16** — A hosted video shows "Processing" until the worker is done, "Failed" if it cannot be
  made playable, and nothing once ready; none of these holds up "Next" or saving. Refusals use
  the code's own words.

## Product acceptance
Judged on a phone (~360px) first.
- **A1** — A first-time seller lists a kurta with three photos, start to "On sale", in five minutes
  or less, timed with the owner's father on his own phone.
- **A2** — Tapping "Put on sale" with no price lands on Price & stock with the error under Price.
- **A3** — A shop selling on Amazon sees "Amazon also asks: Fabric" on Details before saving.
- **A4** — Switching Abaya to Ring lists the three answers that won't carry over; "Keep Abaya"
  changes nothing; switching back after confirming restores them.
- **A5** — Editing the price from the overview and tapping back shows "Leave without saving?".
- **A6** — The admin changes a price while the shop has the form open; the shop's save is refused
  naming "Bhendi Bazaar team, 2 min ago", and its own edits reappear on the latest product.
- **A7** — An admin edit leaves one audit entry with reason and before/after, and the shop's product
  reads "Edited by Bhendi Bazaar team · 30 Oct".
- **A8** — No step, sheet or button in the form is ever disabled.
- **A9** — A seller adds a 40-second phone video on Photos and video: its row reads "Processing",
  "Next" and "Put on sale" still work, and it plays on the product page once ready. A 250 MB file
  is refused with "Too large: {file}. A video is at most 200 MB"; a 2-minute one turns "Failed".
- **A10** — An eleventh item is refused with "A product can have at most 10 gallery items"; a
  video row has no "Cover" button.

## Scope
- **Outcome:** a seller lists or changes a product in short steps on a phone, and the team can do
  it for them, on record.
- **In:**
  1. Stepped create with progress, More options, Review and success — R1–R4, R13, A1, A2, A8.
     Photos and video carried into the first step unchanged in behaviour — R14–R16, A9, A10.
  2. Live readiness hints per step — R5, A3.
  3. Category-change sheet and kept answers — R6, A4.
  4. Edit overview, device draft, leave sheet, conflict refusal — R7–R9, A5, A6.
  5. Admin add and edit for a shop, with reason and audit — R10, R11, A7.
  6. "Edited by Bhendi Bazaar team" notice and history on the shop side — R12, A7.
- **Later:** server-side drafts (Q24) · editing many products at once from the list (Q25) ·
  photo-to-facts suggestions (Q26) · regional languages (parent Later) · timing captured in the
  app (Q28) · undoing an admin edit from history (Q29) · a failed video's reason on its row (Q33).

## Open questions
None — Q20, Q21 and Q22 are decided.
