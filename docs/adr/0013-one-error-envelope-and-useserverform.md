# ADR-0013: Errors travel in one envelope; forms consume it through `useServerForm`

- **Date:** 2026-08-05
- **Status:** Accepted
- **Context:** A duplicate SKU produced `"Failed to create product"` with no field highlighted, and three independent failures were needed to make that happen: a client wrapper read `error.message` where the route sent `error`, so the real reason was replaced by a plausible-looking fallback; the product form rendered no server error at all, only client validation; and although `validateRequest` had always emitted `details: [{ path, message }]`, its single consumer concatenated them into one string, so no field-attributed error had ever reached a field.

  Two forces make this a structural problem rather than three bugs. **The envelope is a string-keyed contract with no compiler check** — the third such failure in this codebase, after the Razorpay `notes` key and the percent-encoded slug. And **error handling was per-form**, so each of nine forms could get it right or wrong independently; the category form did it correctly while the product form did not, and nothing surfaced the difference.

  There is also no form *renderer* here — three hand-written per-entity forms sharing field primitives — so "make the renderer handle it" was not available as an answer.
- **Decision:**
  1. **One envelope for every failure:** `{ error: string, details?: { path, message }[] }`, defined in `src/lib/api-error.ts` and documented in [CONTRACTS.md](../CONTRACTS.md). `error` is always present and always safe to show; `details` appears when the failure can be blamed on specific input.
  2. **A Zod failure and a database constraint violation produce the same shape.** A form maps `details` onto fields without knowing which produced it — this is what lets a duplicate-SKU error highlight the SKU input, which no amount of client validation could achieve.
  3. **Route handlers return failures through `toErrorResponse`.** Hand-rolling `NextResponse.json({ error: … })` on an error path is a defect.
  4. **Domain code opts in to being shown** by throwing `DomainError` / `NotFoundError` / `ConflictError` / `ForbiddenError`. Anything else is an internal fault: logged in full, reported generically. The dividing line: *if the fix is in config or code it is internal; if the fix is in what the user did or state they control it is a domain error.*
  5. **Clients read failures through `readApiError`.** No wrapper reaches into the response body by hand.
  6. **Forms use `useServerForm`**, which supplies `zodResolver` from the same schema the server enforces, routes `details` to fields via `setError`, and surfaces anything unplaceable. **A form containing error-handling code is a signal the hook is missing something and should grow** — not a licence to handle it locally.
  7. **Migration is obligatory on contact.** Touching a form or a route handler that still uses the old pattern means converting it in the same change. Leaving one behind is how the product form ended up as the only form with no error display while its sibling had one.
- **Alternatives considered:**
  - ***Per-form `try/catch` with a toast*** — the conventional approach, and what the codebase already did. Rejected because it makes correctness a per-form property: nine forms, nine chances to omit field mapping, and no mechanism to notice. It is also what produced the original bug, so it is a tested-and-failed option here rather than a hypothetical.
  - *A generic form renderer driven by a field schema* — would centralise error handling in the rendering layer. Rejected because the three forms have genuinely different layouts (multi-section product, modal seller, inline address) while their **error semantics are identical**. Centralising the identical part in a hook and leaving layout free is the better cut; a renderer would force layout uniformity to buy error uniformity.
  - *Return the raw error message for everything* — preserves every useful message with no work, and is what the old handlers did. Rejected: a raw Prisma message names columns and constraint names, and occasionally embeds connection detail. The `DomainError` opt-in keeps the useful messages while making leakage the exception rather than the default.
  - *tRPC or a typed RPC layer* — would make the envelope compiler-checked and eliminate this class of bug outright. Genuinely better on the specific axis that keeps failing here. Rejected as disproportionate to adopt as an error-handling fix, and worth its own ADR if the API surface grows.
  - *Keep `details` but concatenate it into one message*, as `sellerService` did — rejected: it discards the attribution that is the entire point, and produces multi-line strings in a toast rather than errors on inputs.
- **Consequences:**
  - ✅ A server-only failure — duplicate, stale foreign key, exhausted stock — can highlight the field responsible. Previously impossible.
  - ✅ Client validation and server enforcement come from one schema, so the rules a user sees inline cannot drift from the rules applied.
  - ✅ Adding a form is a `useServerForm` call; error handling is not a thing the author has to remember, which is the only reliable kind of correctness.
  - ✅ One place to change how errors are presented, rather than nine.
  - ⚠️ Every route handler needs conversion, and the ~8 that still cast their body need a schema written first. Incremental, but decision 7 makes it non-optional once a file is touched.
  - ⚠️ Internal errors now say less. That is the intended trade, and it means diagnosing a 500 requires the server log — the message is deliberately not in the response.
  - ⚠️ `useServerForm` becomes load-bearing for every form. A bug in it is a bug everywhere, which argues for keeping it small and well-tested rather than accreting per-form special cases into it.
  - ⚠️ The envelope is still not compiler-checked across the boundary. The shared helpers narrow the risk to two files instead of forty; they do not remove it. Tests pin the key names, which is the available mitigation short of the tRPC option above.
