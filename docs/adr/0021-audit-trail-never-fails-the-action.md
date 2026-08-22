# ADR-0021: The audit trail records an action; it never decides whether it happened

- **Date:** 2026-08-22
- **Status:** Accepted
- **Context:** Every admin service performed its mutation and then appended to `AdminLog`, as two unrelated statements. `AdminLog.adminId` is a foreign key onto `User`, and `session.user.id` is a JWT claim (`token.sub`, `src/lib/auth-config.ts`) that nothing re-checked, so an admin whose row had gone from the production database kept passing `requirePlatformAdmin` while every trail write failed the foreign key.

  What the admin saw in production on 2026-08-22 was not a failed operation. `POST /api/admin/categories` created the category, then the trail write raised `P2003`, and `toErrorResponse` reported it as `409 — That adminId no longer exists`. The admin retried, and the retry failed on the unique slug of the row the first attempt had already created. Two `DELETE`s went the same way: category gone, 409 returned. The reported outcome was the opposite of the real one in every case, and the recovery advice implied by the message ("pick another") pointed away from the actual problem.

  A trail entry is worth having, but it is evidence *about* an operation, not part of it. Writing it after a committed mutation and letting it throw gives it a veto it was never meant to have.
- **Decision:**
  1. **Services never call `adminLogRepository.createLog` directly.** They go through `recordAdminAction` or `recordAdminActionIn` in `server/shared/audit/audit.service.ts`, which is where the choice below is made once instead of at each of the sixteen call sites. `tests/unit/admin-audit-trail.test.ts` enforces it across `server/`.
  2. **After a committed mutation, the trail write cannot fail the request.** `recordAdminAction` swallows its error and reports the whole entry to the platform logs, so the action stays recoverable without being reported as a failure.
  3. **Inside the mutation's transaction, it can and must.** `recordAdminActionIn(tx, entry)` writes through the caller's transaction client and throws with it, so both commit or neither. Swallowing there would be worse than useless: a failed statement has already poisoned the transaction, so the error would simply resurface at `COMMIT`.
  4. **An admin id used as a foreign key is verified, not claimed.** `requirePlatformAdmin` re-reads the row behind `session.user.id` and refuses a session whose user is gone (401), demoted, or blocked (403) — one primary-key read per admin request.
- **Alternatives considered:**
  - *Put every mutation and its trail write in one transaction* — the tidiest-sounding answer, and rejected on inspection. It does not hold for the whole trail: `server/shipping/services/connection.service.ts` logs `PROVIDER_CONNECTION_FAILED` from a `catch`, and an entry recording a failure has to survive precisely when the operation does not. It also does not address the cause — with the dangling id still in place, a category delete would now be *rolled back* by its own audit log, which is consistent but no more correct. It would additionally mean threading a transaction client through five repositories that have no other reason to accept one.
  - *Drop the `AdminLog.adminId` foreign key* — would have made the symptom disappear immediately, and was rejected because the constraint is doing its job. The trail's value is attribution, and an `adminId` that names nobody is not attribution. [ADR-0020](0020-money-bearing-records-never-cascade.md) already settles that attribution-bearing rows do not get loosened for convenience.
  - *Verify the session in `requireSession`, for every authenticated request* — rejected as the wrong scope for the cost. The claim is only used as a foreign key on the admin surface, which is low-traffic; storefront requests would pay a query per request to fix a problem they do not have.
  - *Leave it and re-sign-in when it happens* — the actual production workaround, and not a fix. Nothing about the message pointed at the session, the operation reported the opposite of what it did, and the retry it invited made a second inconsistency.
- **Consequences:**
  - ✅ A completed admin action is reported as completed. The class of bug where a retry compounds a phantom failure is gone at every admin call site, not just the category ones.
  - ✅ A deleted, demoted, or blocked admin loses access on the next request rather than at token expiry — a hole this fix closes incidentally.
  - ✅ `createLog` no longer joins `User` to return a name the writer never reads, removing a query from every admin mutation.
  - ⚠️ A trail entry can now be silently absent from `AdminLog` when the write fails. It is in the platform logs instead, which is a worse place to look. Accepted: a missing entry is recoverable, a misreported operation is not.
  - ⚠️ Admin requests cost one extra primary-key read. Deliberate — an unverifiable claim used as a foreign key is not a cheaper answer, it is a wrong one.
