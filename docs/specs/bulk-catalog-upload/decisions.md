# Decisions — bulk-catalog-upload

- **Verified:** 2026-11-25

> Carried over on 2026-11-25 from the spike `sheet-parsing-options.md` (checked 2026-08-21, fed TRD D2), when a shipped folder came to keep spec.md and decisions.md only ([ADR-0084](../../adr/0084-main-holds-only-finished-work-planning-lives-on-its-feature-branch.md)). The spike itself: `git show f1ef476b:docs/specs/bulk-catalog-upload/sheet-parsing-options.md`.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which library reads a shopkeeper's .xlsx inside a serverless function and writes the per-org sample sheet? | `exceljs` | Claude · reversible | 2026-08-21 | The npm `xlsx` (SheetJS) build is abandoned, with unfixed high-severity advisories (ReDoS, prototype pollution), and this parses hostile files. exceljs is maintained, its streaming reader is about 6× lighter on memory in a memory-capped function, and it reads and writes .xlsx and CSV, so it also makes the sample sheet. Sources: SheetJS npm advisories, 2026 library comparisons (pkgpulse, mfyz) | implemented |
| Q2 | CSV as the only input, with no dependency? | No; CSV is accepted, .xlsx is the main path | Claude · reversible | 2026-08-21 | Shopkeepers live in Excel, and "save as CSV first" is a support conversation per shop; exceljs reads CSV anyway | implemented |
| Q3 | Photos embedded in the sheet? | No; a filename column plus a file-drop match step | Claude · reversible | 2026-08-21 | An embedded image can be extracted, but anchoring a floating image to its row is fragile in real files; a filename match is deterministic and debuggable | implemented |
