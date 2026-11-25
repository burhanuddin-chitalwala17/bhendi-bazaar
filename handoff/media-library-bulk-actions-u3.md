# Handoff — media-library/bulk-actions U3 (selection mode)

- **Status:** In progress
- **Last pushed sha:** (see `git log origin/claude/media-library-build -1`)
- **Goal:** TRD Delivery U3: Select / Done, ticks on tiles, the selection bar (Download · Tag · Retire), the retire confirm, the tag picker, download with progress and outcomes, wired to U1's `orgMediaApiClient` bulk methods and U2's `useLibraryZip(orgId, orgCode)`. Changes behaviour. Closes A1, A2, A3 (bar), A4/A5 (UI half); Q6, Q7, Q12, Q13, Q14, Q16.

## Plan
1. Handoff (this file).
2. Failing tests: selection mode (A1, A2), outcome → copy mapping (A3, A4, A5), bar wiring.
3. `MEDIA_BULK_COPY`; `useLibrarySelection`; outcome mapping; `SelectionBar` grows `hint`, `busy`, action `wrap`; tile selection props; bar component; grid wiring.
4. Gate + integration; /bb-review in a fresh subagent; decisions.md; final commit.

## Done
- (nothing yet)

## Resume (macOS)
```
source ~/.nvm/nvm.sh && nvm use 22
export DATABASE_URL=postgresql://$(whoami)@localhost:5432/bhendi_bazaar_ci
env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate
npm run test:integration
```
