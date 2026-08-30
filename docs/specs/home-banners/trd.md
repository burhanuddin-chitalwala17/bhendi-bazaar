# Home banners — technical approach

**Verified:** 2026-08-30

## Where it lives

`catalog`. A banner is merchandising over catalog content and its links point at
categories and products; it needs no domain of its own, and inventing one would need an
ADR to say why ([ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md)).

## Data

Two tables. `Banner` holds the copy, the artwork and its place in the order;
`BannerAction` holds the calls to action as rows rather than JSON, so a label and a
destination are columns the database can constrain rather than a blob nothing validates.

`BannerAction` cascades from `Banner`. That is the correct side of
[ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md): an action carries no
money and no attribution, and has no meaning apart from the banner it belongs to.

`order` is an `Int`, unique only by convention — a reorder rewrites the whole set inside
one transaction, so a duplicate is a transient state that never commits. `isActive`
separates "taken down" from "deleted", which is what makes a campaign re-runnable.

## Image

No new storage. Artwork goes to Blob through the existing upload route, which gains a
`banners` folder ([ADR-0017](../../adr/0017-video-is-embedded-not-hosted.md) is unchanged
— this is an image).

**Dimensions are stated before the picker opens and checked before the upload starts.**
The spec is one constant, `BANNER_IMAGE` in `src/lib/config.ts`, read by both the label
and the check, so the number an admin is told cannot drift from the number enforced. The
check runs in the browser against the decoded image: it is guidance, and the server does
not re-measure — that would need an image library to defend nothing, since the uploader is
already a platform admin.

## Read path

`bannersDAL.getActiveBanners()`, `cache`-wrapped like every other DAL read. The homepage
is a server component and reads it directly; there is no storefront route handler, because
a read a server component can do does not need one.

## Write path

`POST/GET /api/admin/banners`, `PATCH/DELETE /api/admin/banners/[id]`, and
`PATCH /api/admin/banners/reorder`. Reorder is its own route on purpose: it writes every
row and belongs in one transaction, and folding it into the item PATCH would make the
common edit carry that risk.

Every body is parsed by `bannerFormSchema` (`src/lib/validation/schemas/banner.schema.ts`),
which the admin form also uses as its resolver, so what an admin sees inline is what the
route enforces ([ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md)).
`order` is server-owned and never accepted from a body — a create appends to the end, and
the reorder route is the only thing that sets it.

Mutations go through `recordAdminActionIn` inside their transaction where one exists, and
`recordAdminAction` after it otherwise
([ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md)).

## Ordering in the UI

Move-up / move-down buttons, not drag-and-drop. Drag-and-drop needs a package, and a
pointer-only reorder fails the mobile-first rule
([ADR-0015](../../adr/0015-mobile-first-design.md)) — buttons are reachable by touch and
by keyboard for free.

## Migration

One schema migration, for the tables. **No data migration**, deliberately.

The obvious move is to ship the three hard-coded banners as reference data, the way the
carrier row is shipped, so the hero is never blank. Rejected: they are not reference data.
Production runs perfectly well without them — the hero renders nothing and the homepage is
still a shop — and they are house copy written during development, not something the owner
chose. Inserting them would put words on the shop's most prominent surface that nobody
with authority over the shop had approved, and taking them down would be the owner's first
task rather than their first decision.

The consequence is explicit: **on first deploy the hero is empty until a banner is
created.** That is the intended state, not a gap.

They do go in `prisma/seed/banners.seed.ts`, which is the right home for exactly this:
data a developer wants and production must not have. `prisma/seed-guard.ts` refuses a
deployed or CI environment before it consults anything else, so the seed cannot reach
production even if someone sets the allowlist variable there.

`src/lib/home-banners.ts` is deleted in the same change. Keeping it as a fallback would
be two sources of truth for the same shelf, and would smuggle the same unapproved copy
back in through code.

## Presentation

`HeroBanner` and `HeroSlider` do not change shape. `HeroBannerContent` is already the
props type; the DAL returns it, so the components stay unaware of where the words came
from and remain server-rendered apart from the rail.

## Tests

The reorder transaction, the create-appends-to-end rule, the schema's rejection of a
server-owned `order`, and the dimension check's arithmetic. The storefront's "no active
banners renders nothing" path is the one most likely to regress silently.
