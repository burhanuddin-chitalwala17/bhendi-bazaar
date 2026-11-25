# Social selling — build handoff

- **Verified:** 2026-11-25
- **Branch:** `meta-whatsapp-connector` (rebased on `main` at 1d1bb2a3). Never merge it into `main`; never touch `inappnotification`; never force-push.
- **Read first:** [trd.md](trd.md) (architecture, A-D1…D21), [decisions.md](decisions.md), ADR-0084…0087, and the subfeature's own spec, decisions, ux and trd.

> Read this file to continue the build from any account. It is updated and pushed after every unit, so the
> branch's last commit and this file agree on where the build stands.

## Continue here (new account, 2026-11-25)

The first account reached its usage limit; the master session stopped and its check-in is disabled.
Everything on GitHub is on `meta-whatsapp-connector` up to this commit.

1. **connect-instagram U3 is built but not on GitHub.** Session "Build: connect-instagram unit 3"
   (`session_01Kc21QXpCPcPCStef6CTnBY`, first account) committed it locally (6bf1848b, 4b4e0f58, 4490fd4c,
   65b511f8, merge c9e37846: card, checklist, Turn on replies, return notes, migration
   `20261124200000_instagram_card_facts`; gate green, 826 integration tests). Its push was refused by that
   session's safety check three times. Either open that session in the first account once its limit resets and
   approve `git push origin meta-whatsapp-connector`, or, if its container is gone, **rebuild U3** in the new
   account (it is the first queue row below). Do not rebuild while that push might still land.
2. Then run the queue below, one unit per fresh session, with the prompt template. A new account may also act as
   master: "Read docs/specs/social-selling/build-handoff.md and act as the master session: start the next
   queued unit as a new session using the template there, and keep this file updated after each unit."
3. Usage: a unit costs roughly $5–12 of usage; two units plus a master fill a 5-hour allowance. A session that
   stops on the limit is resumed with a message after the reset, not restarted.

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
trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push to origin meta-whatsapp-connector, also at each green
checkpoint as `<unit> (wip): <what>`, so a usage-limit stop never loses work. Never merge
into main, never touch inappnotification, never force-push. Then update docs/specs/social-selling/build-handoff.md
(move the unit to Done with its commit, note any blocker), commit and push it. Finish with a report under 150 words.
Do not start the next unit.
```

## Done

| Unit | Commit (subject on the branch) |
|---|---|
| meta-foundation U1–U5 | `meta-foundation unit 1` … `unit 5` — Graph client, signed intake, drain and lanes, deauthorize and data deletion, seal, retention and sweep. Implemented |
| connect-instagram U1 | `connect-instagram unit 1: connect and callback` and its review fixes |
| connect-instagram U2 | `connect-instagram unit 2: renewal, health, disconnect [CONTRACT]` (d2fcd2b9) |
| Process | ADRs renumbered 0084–0087; rebased on main; next units' dependencies marked in their TRDs |

## Queue (in order; one at a time)

| # | Unit | Depends on | State |
|---|---|---|---|
| 2 | connect-instagram U3 — card, checklist, Turn on replies, return notes | U2 | built, not pushed (see Continue here 1) |
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
- To verify on dev with the owner's account: Instagram's token answer shape and Bearer-header acceptance; that the
  deauthorize `user_id` equals the `/me` `user_id`; Meta's "message access off" error code; contact re-sync on
  WhatsApp reconnect; Instagram unsend API.
- A stray `/migration.sql` at the container root (outside the repo) can be deleted.

## Blockers raised by build sessions

- 2026-11-25: the U3 session's push to origin was refused three times by its auto-mode safety check (see
  Continue here 1).
- **Seed fails on a fresh database** (not this feature, found by U3): a migration creates the platform org and
  `20261121110000_shop_credits` grants it a `CreditLine`, which `prisma/seed.ts` never deletes, so the org delete
  hits `CreditLine_orgId_fkey`. Workaround: delete the `CreditLine` rows, then seed.
- 2026-11-24 19:50 UTC: the U3 session hit the account's 5-hour usage limit before pushing anything; resumed
  2026-11-25 04:30 UTC after the reset. A stopped session is resumed with a message, not restarted.
- (Not this feature.) The U2 session holds two local commits for `main` (push settings, CLAUDE.md); the repo's
  deny rule refuses a push to `main`, so the owner pushes those or merges them by PR. Both are already on this
  branch as 111f5652 and 0c696196.
