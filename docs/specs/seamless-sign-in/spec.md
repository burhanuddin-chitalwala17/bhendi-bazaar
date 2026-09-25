# Spec — seamless-sign-in

- **Summary:** Signing in happens over the current page, keeps the shopper's place, and finishes what prompted it — checkout included
- **Status:** Implemented — PR-111
- **Domain:** identity, with UI in the storefront chrome, wishlist and checkout; cart
- **Phase:** —
- **Verified:** 2026-09-18
- **References:** [trd.md](trd.md), [contact-us](../contact-us/), [inventory-reservation](../inventory-reservation/), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0016](../../adr/0016-mobile-app-shell.md), [ADR-0024](../../adr/0024-phone-is-contact-data-not-an-identity-key.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

Signing in, creating an account and requesting a password reset happen in a panel over
the page the shopper is on — the same panel as Contact us. When it succeeds, the panel
closes, the shopper is still where they were, and whatever they were trying to do when
asked to sign in is done.

## Why

Today signing in is a detour: it leaves the page, and afterwards lands on the home page
whatever the shopper was looking at. Someone who taps the heart on a product, is told to
sign in, and signs in, ends up on the home page with nothing saved. A guest halfway
through checkout who remembers they have an account has no way to use it without
leaving checkout. Most give up there.

Sign-in should cost a pause, not the shopper's place, and it should finish the thing that
prompted it — otherwise the prompt is only an obstacle.

## Requirements

### The panel

- R1 — **Login** in the header (desktop) and in the tab bar (phone) opens a panel rather
  than navigating. It rises from the bottom on a phone and slides in from the right on
  desktop.
- R2 — The panel opens on **Sign in**: email, password, Forgot password?, Continue with
  Google, and Create an account.
- R3 — **Create an account** and **Forgot password?** replace the form in the same panel,
  and each has a way back to Sign in. The address bar does not change, so a back gesture
  does not discard what was typed.
- R4 — Forgot password asks for an email and confirms "check your inbox" in the panel.
  The link in that email still opens the reset-password page.
- R5 — After signing in or creating an account, the panel closes and the shopper stays on
  the same page. Everything that depends on being signed in — header, tab bar, cart,
  saved hearts, page content — reflects it without a full reload.
- R6 — **Continue with Google** returns the shopper to the page they started on.
- R7 — A failure (wrong password, email already registered) is shown in the panel, and
  what was typed stays in the form.
- R8 — Signing in, creating an account and requesting a reset each look and behave the
  same wherever they appear — the same fields, rules, messages and outcomes on the page
  and in the panel.

### Finishing what prompted it

- R9 — Every storefront prompt to sign in opens this panel: the heart on a product, the
  wishlist page, the profile page and checkout. The wishlist page shows a sign-in prompt
  to a guest instead of sending them away.
- R10 — When the panel was opened by an action that needs an account, that action
  completes once sign-in succeeds — by password, by a new account, or by Google. The
  panel says what it is for ("Sign in to save this").
- R11 — Closing the panel without signing in abandons the action. Nothing happens later.
- R12 — Completing an action never reverses anything: saving a product that the account
  had already saved leaves it saved.

### Signing in at checkout

- R13 — A guest at checkout is offered **Already have an account? Sign in** beside the
  delivery details, and it opens the panel.
- R14 — After signing in, the shopper stays on checkout: their saved addresses replace
  the guest form, and discounts and coupon eligibility are recalculated for the account.
- R15 — The items being checked out do not change. Anything already in the account's
  cart from an earlier visit stays in the cart and is not added to this checkout.
- R16 — Placing an order removes from the cart only what was bought, whether it came from
  the cart or from Buy Now. Anything else in the cart remains.

### Pages and portals

- R17 — The sign-in, sign-up and forgot-password pages remain for links, bookmarks and the
  portals, and return the shopper to where they were sent from rather than the home page.
- R18 — The admin and organisation portals keep sending a signed-out visitor to the
  sign-in page. Nothing about who may enter them changes.

## Product acceptance

- A1 — On a ~360px phone, on a product page: tap Login, sign in in the bottom sheet; the
  sheet closes on the same product and the tab bar reads Account.
- A2 — On a phone, a guest taps the heart on a product; the sheet says "Sign in to save
  this"; after signing in, the sheet closes, the heart is filled, and the product is on
  the wishlist page.
- A3 — As A2 but through Continue with Google: the shopper returns to the same product,
  heart filled.
- A4 — As A2 but through Create an account: the new account has the product saved.
- A5 — A guest taps the heart, then closes the sheet; signing in later from Login saves
  nothing.
- A6 — On desktop, a guest with items in the cart signs in from the panel; the page stays,
  and the cart page shows the merged items.
- A7 — A wrong password shows an error in the panel with the email still filled in; the
  same attempt on the sign-in page shows the same message.
- A8 — Forgot password in the panel sends the reset email and confirms in place.
- A9 — A signed-out visit to `/admin` goes to the sign-in page, and signing in there
  returns to `/admin`.
- A10 — On a phone, a guest at checkout with items A and B signs in from the checkout
  prompt; the sheet closes on checkout, which shows the account's saved addresses and
  still A and B.
- A11 — As A10, where the account's cart already held item C: after paying, the cart
  holds C, and A and B are gone.
- A12 — A signed-in shopper with A in the cart uses Buy Now on B and pays; A is still in
  the cart.

## Out of scope (this feature)

- New ways to sign in (phone OTP, magic links). Phone sign-in is blocked on its own ADR
  ([ADR-0024](../../adr/0024-phone-is-contact-data-not-an-identity-key.md)).
- Resuming actions other than saving a product — checkout needs none, because signing in
  there changes the page rather than performing an action, and bidding proceeds as a
  guest. The mechanism is expected to take more when one appears.
- Resetting the password itself inside the panel; the emailed link opens a page.
- Saving the address a guest typed at checkout to the account they then sign in to; it
  is discarded, and they choose or add an address.
- Changes to session lifetime, providers, or server-side authentication.
