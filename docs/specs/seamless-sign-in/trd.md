# TRD — seamless-sign-in

- **Status:** Implemented — PR-111
- **Domain:** identity, with UI in the storefront chrome, wishlist and checkout; cart
- **Phase:** —
- **Verified:** 2026-09-18
- **References:** [spec.md](spec.md), [contact-us trd.md](../contact-us/trd.md), [inventory-reservation](../inventory-reservation/), [ADR-0003](../../adr/0003-one-repository-per-aggregate.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

Authentication itself does not change: next-auth v4 with the credentials and Google
providers in `src/lib/auth-config.ts`. What changes is where the forms render, what
happens after they succeed, and how checkout and the order transaction treat a shopper
who becomes signed in mid-flow.

Each form becomes one component, rendered by both its page and a single auth sheet. The
sheet is mounted once inside the storefront providers and opened through a context:
`open({ view, reason, intent })`. It reuses the `adaptive` side of
`src/components/ui/sheet.tsx` and the in-place step pattern of
`src/components/support/contact-sheet.tsx`.

## Technical decisions

### Forms and the sheet

- **D1 — One component per form; hosts only supply callbacks.** `SignInForm`,
  `SignUpForm`, `ForgotPasswordForm` and `GoogleSignInButton` live in
  `src/components/auth/`. Each owns its fields, schema (`loginSchema`, `signupSchema`,
  `forgotPasswordSchema`), `useServerForm` submit and messages (ADR-0013). A host passes
  `onSuccess` and `onSwitchView` and nothing else. The pages in `src/app/(auth)/` and the
  sheet are a heading plus a form — neither contains a field, a schema or a submit. There
  is no sheet variant of any form; a difference between page and panel is a bug (spec R8).
- **D2 — One sheet for the app, not one per trigger.** Contact us mounts a sheet per
  launcher (contact-us D6) because its only triggers are two buttons. Sign-in is asked for
  from the chrome, page bodies, checkout and `WishlistContext`, which renders nothing, so
  a provider-mounted sheet with an `open()` hook is the only shape that serves all of them.
- **D3 — Staying on the page.** Credentials sign-in uses `redirect: false`; in next-auth
  v4 that refreshes the `useSession` store on success, which `useCartSync` already
  watches to merge the cart. The sheet then calls `router.refresh()` so server-read
  state — the saved-product set read in `src/app/(main)/layout.tsx` — re-renders.
- **D4 — Sign-up keeps its fallback in place.** If auto sign-in after a successful signup
  fails, the host switches to Sign in with the email filled, rather than navigating.
- **D5 — `callbackUrl` is honoured on the pages, only if relative.** The pages push to `/`
  regardless today. A value is used only when it is a same-origin path (a single leading
  `/`), else `/` — pushing an attacker-supplied absolute URL is an open redirect.

### Intents

- **D6 — A pending action is a named, serialisable intent, not a closure.** The only kind
  is `wishlist.save` with a product id, run by a registry of handlers. A closure cannot
  survive the Google round trip. Order on success: session refresh → intent →
  `router.refresh()`, so the refreshed saved set already contains the product.
- **D7 — Google carries the intent in `sessionStorage`**, written before `signIn("google")`
  with the current URL as `callbackUrl`. The provider reads it once the session is
  `authenticated`, removes it before running it, and drops it if older than 10 minutes, so
  a reload cannot repeat it and a cancelled trip cannot fire later. Per-tab by design.
- **D8 — Intents must be idempotent; closing discards them.** `POST /api/wishlist` already
  treats saving a saved product as a no-op, so `wishlist.save` is a save, never the
  heart's toggle. Closing the sheet clears the intent in memory and storage.
- **D9 — The wishlist page stops redirecting a guest.** It renders a prompt card that opens
  the sheet; the profile page's "Go to login" becomes the same opener.

### Checkout

- **D10 — Signing in at checkout needs no intent.** The guest address section gets the
  prompt; `CheckoutContainer` already switches from `GuestAddress` to
  `AuthenticatedAddress` on `useAuth`, and `useAddressManager` fetches when `autoFetch`
  flips. Two gaps are closed on the guest → authenticated transition: the guest's typed
  address stays selected (an order carries its address inline, so no account id is needed;
  was: cleared, which made a buyer type it twice — fixed 2026-11-12), and `useCheckoutOffers` re-quotes,
  because the quote route reads the session's `userId` but the hook keys only on basket
  and code.
- **D11 — Checkout keeps its item snapshot.** `CheckoutContainer` reads the cart store once
  on mount; the sign-in merge updates the store, not the snapshot. That is now the rule
  (spec R15), not an accident, and a test holds it.
- **D12 — An order removes the bought lines, not the cart.** The order transaction today
  deletes the whole cart row (`server/checkout/order.service.ts:401`), including for
  Buy Now. It instead calls a cart repository method taking `tx` that deletes the lines
  matching the order's `(productId, size, color)` — the key in `server/cart/cart.merge.ts`
  — and bumps `version`, so a stale write from another tab conflicts rather than restoring
  them. This also moves the order service's direct `tx.cart` write behind the one cart
  repository (ADR-0003). After payment, the client removes the same lines instead of
  `clear()`. inventory-reservation R6 is reworded to match in the same PR.

## Packages

None.

## UI approach

**Phone first (~360px).** Login in the tab bar becomes a button opening a bottom sheet;
like Contact, it never shows as active. The sheet stacks title, optional reason line and a
close button, then the form single-column: 16px inputs, full-width primary button, Google
button, view-switch link. Views replace one another in place. `max-h-overlay
overflow-y-auto` keeps the submit reachable above the keyboard. On checkout the prompt is
one line above the guest delivery form, a ≥40px target.

**Desktop (`md`+).** The header's Login opens the same sheet as a right-hand panel. Form
markup moves as-is, through tokens (ADR-0022).

## Data model

None. Cart lines are removed, not reshaped.

## API / contract changes

None. Routes are called as today and already answer through `toErrorResponse`.

## Test plan

- `tests/unit/auth-forms.test.tsx` — each page and the sheet render the same form
  component; success calls `onSuccess`; a failure keeps typed values.
- `tests/unit/auth-sheet.test.tsx` — opens on Sign in; switches views in place; success
  closes and refreshes; signup fallback lands on Sign in.
- `tests/unit/auth-intent.test.ts` — runs once after sign-in; closing discards; a stored
  intent is removed before running, and one past 10 minutes is dropped.
- `tests/unit/safe-callback-url.test.ts` — relative paths pass; `//host`, absolute and
  `javascript:` URLs fall back to `/`.
- `tests/unit/wishlist-button.test.tsx` — a guest's tap opens the sheet with an intent.
- `tests/unit/checkout-sign-in.test.tsx` — on sign-in the address clears, offers re-quote,
  and items stay as snapshotted.
- Order transaction test — removes only bought lines, for cart and Buy Now; bumps version.

## Delivery (PRs)

1. Order removes only bought lines, server and client (D12). Changes behaviour; stands
   alone, since the Buy Now case exists today.
2. Extract the forms; pages render them and honour `callbackUrl` (D1, D5).
3. Auth sheet and provider; header and tab bar Login open it (D2–D4). Changes behaviour.
4. Intents: heart, wishlist page, profile page, Google round trip (D6–D9).
5. Checkout prompt, address reset and re-quote (D10, D11).

## Open questions

None.
