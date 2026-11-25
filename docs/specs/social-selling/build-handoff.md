# Social selling — build handoff

- **Verified:** 2026-11-25
- **Branch:** `meta-whatsapp-connector` (rebased on `main` at 1d1bb2a3). Never merge it into `main`; never touch `inappnotification`; never force-push.
- **Read first:** [trd.md](trd.md) (architecture, A-D1…D21), [decisions.md](decisions.md), ADR-0084…0087, and the subfeature's own spec, decisions, ux and trd.

> Read this file to continue the build from any account. It is updated and pushed after every unit, so the
> branch's last commit and this file agree on where the build stands.

## Continue here (second account, master session, 2026-11-25)

**Scope (owner, 2026-11-25): build the whole feature in this run** — every social-selling subfeature, all of
notification-hub, ai-images/social-posts, bulk-publish and checkout-links.

**Parallel lanes (owner, 2026-11-25).** Parallelism is bounded only by dependencies: every unit whose `after …`
units are on the branch starts at once, one unit per session (ADR-0080 still holds). Each lane is its own worktree
(`bhendi-bazaar-meta-whatsapp-connector/`, `bhendi-bazaar-ss-lane<N>/` on local branch `ss-lane<N>`), its own
`node_modules`, and its own local Postgres on port 543<N+1> holding a `bhendi_bazaar_ci` database
(`tests/helpers/test-db.ts` allows only `bhendi_bazaar_dev`/`bhendi_bazaar_ci` and silently skips any other name;
data dirs in `Bhendi-bazaar-master/.pg-lanes/`). A lane pushes with `git pull --rebase origin
meta-whatsapp-connector` then `git push origin HEAD:meta-whatsapp-connector`; never force. A migration that sorts
before one that arrived is renamed later. The master keeps this file in its own docs-only worktree
(`bhendi-bazaar-ss-master/`). Run vitest on Node 22 (the default Node 20 crashes it): `export PATH=$HOME/.nvm/versions/node/v22.23.3/bin:$PATH`. A unit took ~26 minutes; usage limits stop every lane at once — sessions push at
green checkpoints and resume after the reset.

**Paused for optimisation (owner, 2026-11-25):** no new units start; the running ones finish, then the build stops.

**Running now (lane):** notifications-core U2 (3), notifications-core U3 (8), inbox-core U4 (14), consent-core U3 (6), post-composer U2 (4), instagram-publishing U1 (2),
inbox-core U2 (5), inbox-core U3 (11), inbox-instagram U1 (12),. A lane whose unit is on origin
is removed (worktree, local branch, its Postgres); a new unit gets a fresh lane. Lanes export `VITEST_MAX_WORKERS=2` (12 cores) and `GIT_TRACE2_EVENT=0` (git hangs on the git-ai daemon socket). Sessions write commit messages with `git commit -F -`, never a shared temp file (one was
overwritten by another lane). Every TRD's Delivery lines carry `after …` marks — the next ready units are read from them.

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
| connect-instagram U3 | `connect-instagram unit 3: card, checklist, Turn on replies, return notes [CONTRACT] [MIGRATION]` (8f01f51a); rebuilt by the second account. Gate green, integration 823 passed. Departs from ux.md per decisions Q19, accepted as built by the owner 2026-11-25 |
| whatsapp-catalogue U1 | `whatsapp-catalogue unit 1: item builder and content hash` (5719a40f). Q15 (brand, condition sent; reversible) |
| consent-core U1 | `consent-core unit 1: audience domain, contacts, consent log, projection and may [CONTRACT] [MIGRATION]` (5c0426f6) |
| post-composer U1 | `post-composer unit 1: post model, drafts and version-checked autosave [CONTRACT] [MIGRATION]` (6d949b2b). Q15: stale autosave's 409 omits the newer draft (reversible) |
| inbox-core U1 | `inbox-core unit 1: conversations and messages land from the sinks, sealed per shop [MIGRATION]` (d8198a91). Q17 per-table sequences, Q18 extra columns; unsent Instagram messages parked for the owner |
| checkout-links U1 | `checkout-links unit 1: links made, opened once per cart at today's prices [CONTRACT] [MIGRATION]` (1f176af0). Q4–Q6 |
| whatsapp-sending U1 | `whatsapp-sending unit 1: campaigns domain, settings, rates, spend, and the port [CONTRACT] [MIGRATION]` (7297beae). Q14–Q21; **owner: confirm the per-message rates (87 and 12 paise) against Meta's price list before the first paid send** |
| notifications-core U1 | `notifications-core unit 1: events, deliveries, email plug, badge [CONTRACT] [MIGRATION]` (747bb0c8). Q9, Q10; TRD D7 (13-month retention) had no unit — assigned to U3 by the master |
| inbox-whatsapp U1 | `inbox-whatsapp unit 1: WhatsApp messages land — E.164 keys, re-key on new user id, locations, echo time` (726a4a53). Q12; Meta's `user_changed_user_id` field name assumed |
| ai-images/social-posts U1 | `ai-images/social-posts unit 1: social purpose, social.v1 prompt, model order and post presets [CONTRACT] [MIGRATION]` (da60a4ab). Q50 in ai-images/decisions.md; presets route moves to U4 |
| connect-whatsapp U1 | `connect-whatsapp unit 1: CSP, SDK leaf, single-use state, signup route [CONTRACT] [MIGRATION]` (22a5bfed, fbdaa85f). Q18–Q25; **TRD D4 (Meta's weekly limit) has no unit — needs the sandbox's error code**; Q25 left to U2 |
| ai-images/social-posts U3 | `ai-images/social-posts unit 3: captions from live facts, price staleness and Update price [CONTRACT] [MIGRATION]` (40ec4f42). Q50–Q53: `captionStillTrue(postId, caption)` takes the caption |
| checkout-links U2 | `checkout-links unit 2: checkout groups a link's items with its notes, the size step, order attribution [CONTRACT]` (217ab934, 905ed63f). Q7–Q10; Q9: a forwarded link may point at an unpaid order |
| Planning | notification-hub and publishing units marked (7017d471); all remaining units marked, social-posts U4 added, connection-ready event in post-composer U3 (34f25c60) |
| Process | ADRs renumbered 0084–0087; rebased on main; next units' dependencies marked in their TRDs |

## Queue (in order; one at a time)

**Owner's scope for this run (2026-11-25):** connect, catalogue, notifications (all of notification-hub) and
publishing, then stop and report. Before notification-hub and publishing are queued, one planning session marks
their TRDs' Delivery units `after U<k>` / `independent` and settles their order (known: whatsapp-status-kit needs
notifications-core; post-composer U3 needs ai-images/social-posts U3's `captionStillTrue`).

| # | Unit | Depends on | State |
|---|---|---|---|
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

- 2026-11-25: full integration runs under parallel load fail in meta-drain, marketplace-*, stock-sync, product-bulk-actions; each passes alone on origin (meta-drain 9/9 checked by the master). Suspected order dependence on shared rows — one clean full run is due after the pause.

- 2026-11-25 owner decisions: post-composer U3 adds the "connection ready" event (emitted from the connect
  flows); ai-images/social-posts gets a UI unit 4; social-posts U3 builds before U2 (U2's check reads text back).
- 2026-11-25: connect-instagram Q19 (card departs from ux.md) — **owner accepted it as built**.
- 2026-11-25: the first account's U3 push problem is resolved by the rebuild above; its local commits are obsolete.

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
