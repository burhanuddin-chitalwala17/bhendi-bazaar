# Social selling — build handoff

- **Verified:** 2026-11-24
- **Branch:** `meta-whatsapp-connector` (rebased on `main` at 1d1bb2a3). Never merge it into `main`; never touch `inappnotification`; never force-push.
- **Read first:** [trd.md](trd.md) (architecture, A-D1…D21), [decisions.md](decisions.md), ADR-0084…0087, and the subfeature's own spec, decisions, ux and trd.

> Read this file to continue the build from any account. It is updated and pushed after every unit, so the
> branch's last commit and this file agree on where the build stands.

## How the build runs

Planning is finished: every subfeature has an Accepted TRD and a signed-off ux.md. Building follows ADR-0080:
**one unit per fresh session**, never in a session that planned. A *master* session (optional) starts each unit
as a new session, waits for it to end, reads only its final report, and starts the next. Without a master,
the owner pastes the next prompt into a new session.

**Prompt for one unit** (replace `<feature>`, `<n>` and the Delivery line, from the subfeature's `trd.md`):

```
Build social-selling/<feature> unit <n> by invoking the bb-build skill (as `/bb-build social-selling/<feature> unit <n>`).
Work only on branch meta-whatsapp-connector: fetch, check it out and pull --ff-only before starting. Build exactly this
one unit (Delivery <n>: <description>). Failing test per acceptance id first; mutation-test each new guard; checks with
`npm run gate` (stop after two identical failures and report); integration tests need Postgres: `service postgresql start`,
`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bhendi_bazaar_dev npx prisma migrate deploy`, then
`npm run test:integration`; /bb-review in a fresh subagent, fix its findings. Commit subjects `<area>: <what changed>`,
trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push to origin meta-whatsapp-connector. Never merge
into main, never touch inappnotification, never force-push. Then update docs/specs/social-selling/build-handoff.md
(move the unit to Done with its commit, note any blocker), commit and push it. Finish with a report under 150 words.
Do not start the next unit.
```

## Done

| Unit | Commit (subject on the branch) |
|---|---|
| meta-foundation U1–U5 | `meta-foundation unit 1` … `unit 5` — Graph client, signed intake, drain and lanes, deauthorize and data deletion, seal, retention and sweep. Implemented |
| connect-instagram U1 | `connect-instagram unit 1: connect and callback` and its review fixes |
| Process | ADRs renumbered 0084–0087; rebased on main; next units' dependencies marked in their TRDs |

## Queue (in order; one at a time)

| # | Unit | Depends on | State |
|---|---|---|---|
| 1 | connect-instagram U2 — renewal, health, deauthorize wiring, disconnect | U1 | building (started 2026-11-24 18:40 UTC) |
| 2 | connect-instagram U3 — card, checklist, Turn on replies, return notes | U2 | queued |
| 3 | connect-whatsapp U1 — CSP, SDK leaf, state, signup route | — | queued |
| 4 | connect-whatsapp U2 — setup job and health | U1 | queued |
| 5 | connect-whatsapp U3 — card states, checklist, disconnect | U2, connect-instagram U3 | queued |
| 6 | whatsapp-catalogue U1 — item builder and hash (pure) | — | queued |
| 7 | whatsapp-catalogue U2 — create/attach, sync, batches | U1, connect-whatsapp U2 | queued |
| 8 | whatsapp-catalogue U3 — triggers from catalog and promotions; nightly pass | U2 | queued |
| 9 | whatsapp-catalogue U4 — card line, details, Sync now | U3 | queued |
| 10 | whatsapp-catalogue-import U1 — reader, Listings page with WhatsApp as source | connect-whatsapp U2 | queued |
| 11 | whatsapp-catalogue-import U2 — done push through the item builder | U1, whatsapp-catalogue U2 | queued |
| 12 | whatsapp-catalogue-import U3 — unreadable path and card step | U2 | queued |

**After the queue:** notifications-core; post-composer, instagram-publishing, whatsapp-status-kit,
ai-images/social-posts; inbox-core, inbox-instagram, inbox-whatsapp, comment-automations, enquiry-autoreplies,
product-answers; consent-core, whatsapp-sending, audience, whatsapp-campaigns; social-home; notification-hub's
hub-marketing, order-updates, demand-alerts; bulk-publish; checkout-links. Before queueing these, a planning
session marks each TRD's Delivery units `after U<k>` or `independent` (ADR-0080 decision 4) — done so far for
the four subfeatures above only.

## Owner's open items (none blocks the build)

- Meta app: Business Verification; register `<domain>/api/channels/instagram/callback` (Instagram Login redirect),
  `/api/channels/instagram/deauthorize` (deauthorize) and `/api/channels/meta/data-deletion` (data deletion).
- Set `SOCIAL_CONNECT=instagram` (later `,whatsapp`) with the `META_*` settings (docs/OPERATIONS.md) when opening.
- Do not open Instagram to shops until connect-instagram U2 (token renewal) has shipped.
- To verify on dev with the owner's account: Instagram's token answer shape and Bearer-header acceptance; that the
  deauthorize `user_id` equals the `/me` `user_id`; Meta's "message access off" error code; contact re-sync on
  WhatsApp reconnect; Instagram unsend API.
- A stray `/migration.sql` at the container root (outside the repo) can be deleted.

## Blockers raised by build sessions

None yet.
