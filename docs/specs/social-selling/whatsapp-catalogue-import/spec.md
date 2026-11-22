# Spec — social-selling/whatsapp-catalogue-import

- **Summary:** A shop that already has a WhatsApp catalogue settles it when it connects: each item is matched to one of its products, added as a new product, or left off, before Bhendi Bazaar takes the catalogue over
- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q47), [connect-whatsapp](../connect-whatsapp/spec.md), [whatsapp-catalogue](../whatsapp-catalogue/spec.md), [product-merge](../../marketplace-integration/product-merge/spec.md), [channel-import](../../marketplace-integration/channel-import/)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Catalogue.
> Runs once, between connect-whatsapp and whatsapp-catalogue's first push.

## What this feature is
The step after connecting WhatsApp for a shop whose Business app already has a catalogue. Its
items appear on the same Settle screen shops use for Amazon and Flipkart listings, and each is
matched, added or left off. Only then does Bhendi Bazaar make the catalogue a copy of the store.

## Why
Many shops typed a catalogue into the Business app by hand, and their buyers' old chats link to
those items. Replacing it would throw that work away and break the links; ignoring it would leave
two catalogues that disagree (parent Q47). Settling once turns the shop's work into its products.

## Requirements
- R1 — After connecting, if the number has a catalogue with items, the shop is taken to settle it
  before anything is sent to WhatsApp. With none, this step is skipped and whatsapp-catalogue makes
  one.
- R2 — Each WhatsApp item shows what the shop typed: name, photos, price, description and its own
  id, beside our nearest product when there is one.
- R3 — Every item offers three choices, as on Amazon and Flipkart: match to a product, add as new,
  or leave off. Matches are suggested, never decided on a name alone (Q1).
- R4 — Matching links the item to the product; from then on the product's details win, and the item
  keeps its WhatsApp id so links in buyers' old chats still open (parent Q47). Where the item's
  price differs from the product page's, the screen says WhatsApp will show the page's price.
- R5 — Adding as new makes a product from the item, its photos copied into the shop's library, and
  asks "How many do you actually have?", since WhatsApp holds no stock count (Q4).
- R6 — Leaving off removes the item from WhatsApp once settling is done; the screen says how many
  will be removed before the shop confirms (parent Q47).
- R7 — Settling can be left and resumed; nothing in WhatsApp changes until the shop taps Done (Q2).
  Done hands the catalogue to whatsapp-catalogue, which makes it a copy of the store.
- R8 — Items the shop grouped as one item with options settle item by item; making them one
  family is the existing family flow, afterwards (Q3).
- R9 — If the catalogue cannot be read, the step says so plainly and offers the bulk upload sheet,
  and the shop's products are pushed as usual (parent Q47).

## Hazards the TRD must answer
- **A large catalogue** (hundreds of items and photos) read and copied without timing out.
- **The shop edits the catalogue in the app while settling:** Done must act on what is there then.
- **Prices typed as text** ("Rs 1,299/-") read into paise, or shown as unreadable, never guessed.
- **A photo that fails to copy** leaves the new product saved, with the photo marked to retry.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A shop whose Business app holds 40 items connects WhatsApp and lands on Settle with 40 items.
- A2 — Matching an item to a product shows, after Done, the product's name and page price in the
  WhatsApp app, under the same item.
- A3 — Adding an item as new creates a product with its photos in the library and the count given.
- A4 — Leaving off 5 items shows "5 will be removed from WhatsApp" before Done, and removes them after.
- A5 — Leaving and returning keeps every choice made; WhatsApp is unchanged until Done.
- A6 — A catalogue that cannot be read shows the plain message and the bulk upload sheet.

## Scope
- **Outcome:** a shop's existing WhatsApp catalogue becomes its products, settled once.
- **In:** R1–R9, tested by A1–A6.
- **Later:** grouping settled items into a family here (Q3).

## Open questions
Q1, Q2, Q3.
