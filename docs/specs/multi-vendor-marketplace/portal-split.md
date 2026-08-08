# Portal split — where every existing surface lands

- **Verified:** 2026-08-08
- **References:** [spec.md](spec.md), [portal-separation](portal-separation/), [CONTRACTS.md](../../CONTRACTS.md)

A supporting artifact, not line-capped ([ADR-0010](../../adr/0010-spec-convention.md)). Swept 2026-08-08:
15 pages under `src/app/(admin)/` and 22 route handlers under `src/app/api/admin/`. Every one is
classified, because the failure mode here is a page that quietly stays platform-wide while its audience
becomes an organisation — a vendor seeing another vendor's orders.

**Platform** = the people who run the store. **Org** = a selling organisation. **Both** = the page
exists for each audience but answers a different question, so it is scoped rather than duplicated.

## Target route structure

| Group | Path | Audience |
|---|---|---|
| `(main)` | `/` … | buyers — unchanged |
| `(org)` | `/org/[orgId]/…` | organisation members; `orgId` in the path is the authorization subject |
| `(admin)` | `/admin/…` | platform owners — keeps its name and shrinks to platform-only work |

APIs mirror it: `/api/org/[orgId]/…` and `/api/admin/…`. Moving a handler between those two is a
`[CONTRACT]` change and its client wrapper moves with it.

## Pages

| Today | Lands as | Note |
|---|---|---|
| `admin` (dashboard) | **Both** | Same shape, different scope: an org's own numbers vs the platform's. The org version has no cross-vendor totals. |
| `admin/products` | **Org** | Platform keeps a read-only cross-vendor list for support; it is not the same page. |
| `admin/products/new`, `[id]`, `[id]/edit` | **Org** | Gains a pickup-location and per-location stock section ([stock-locations-and-allocation](stock-locations-and-allocation/)). |
| `admin/orders`, `[orderId]` | **Both** | An org sees orders having a shipment from one of its locations — *not* orders having its products, which would leak a cross-vendor basket. |
| `admin/reviews` | **Both** | An org sees reviews on its own products. Moderation and deletion stay platform. |
| `admin/carts` (abandoned) | **Platform** | A cart can hold items from several orgs, so it is nobody's to see but the platform's. |
| `admin/categories`, `new`, `[id]/edit` | **Platform** | Taxonomy is platform-owned by decision. |
| `admin/sellers` | **Platform** | Becomes the organisations list. |
| `admin/users` | **Platform** | Buyer accounts. An org sees its *members*, which is a different page. |
| `admin/shipping/providers` | **Platform** | Courier accounts are platform-wide by decision; credentials never reach an org portal. |

## Route handlers

| Today | Lands as | Note |
|---|---|---|
| `products`, `products/[id]` | **Org** | Every write filters on the path's org. |
| `orders`, `orders/[id]` | **Both** | Scoped by shipment origin for an org. |
| `reviews`, `reviews/[id]` | **Both** | Read scoped for an org; destructive actions platform-only. |
| `dashboard`, `dashboard/activities` | **Both** | Two queries, one shape. |
| `shipments/[id]/tracking` | **Both** | An org needs tracking for its own shipments. |
| `upload` | **Both** | Shared, but the stored path should carry the org so one org's uploads are attributable. |
| `abandoned-carts` | **Platform** | |
| `categories`, `categories/[id]` | **Platform** | |
| `sellers`, `sellers/[id]` | **Platform** | Becomes orgs. |
| `users`, `users/[id]`, `users/[id]/block` | **Platform** | |
| `shipping/providers`, `[id]/connect`, `[id]/disconnect` | **Platform** | |

## New surfaces

| Surface | Owner |
|---|---|
| Create an organisation | [org-onboarding](org-onboarding/) |
| Organisation switcher, replacing the fixed "Bhendi Bazaar" title in `src/admin/sidebar.tsx`; header bar with the signed-in user | [org-portal-chrome](org-portal-chrome/) |
| Team list, invite, role change, remove | [org-team](org-team/) |
| Pickup locations CRUD, per-location stock | [stock-locations-and-allocation](stock-locations-and-allocation/) |

## The authorization change

Today one check decides everything: `src/middleware.ts:114` reads `role` off the token and gates
`/admin`. That is sufficient for two audiences and wrong for three, because an org member is not a
platform admin and must still reach a portal.

Three questions replace it, and all three are answered per request:

1. **Signed in?** — as today.
2. **For `/admin/…`, is this a platform admin?** — `User.role === "ADMIN"`, as today.
3. **For `/org/[orgId]/…`, does this user have a membership in *that* org?** — new, and it is a
   database question, not a token question. A membership can be revoked between sign-in and the
   request, so a role baked into a JWT at sign-in would keep working after removal.

That third point is the one to get right. Middleware can cheaply reject a signed-out request, but
membership must be checked where the data is read — otherwise the URL is trusted and `orgId` becomes a
parameter a curious user edits. **Every org-scoped query filters on the path's `orgId` and the
membership is verified in the same request**, which is why the org id belongs in the URL rather than
in a session: a filter you can forget to apply is a leak, and a path parameter is impossible to omit.

## Not a rename

`(admin)` keeps its name and its meaning. What changes is that pages whose audience is a vendor move
out of it. Anything left in `/admin` is platform work by definition, which makes the boundary
checkable: a new page under `/admin` that filters by org is in the wrong tree.
