# Spike — spreadsheet parsing options

- **Verified:** 2026-08-21
- **Feeds:** [trd.md](trd.md) D2

The question: which library reads shopkeeper-supplied .xlsx inside a Vercel
function, and can also generate the per-org sample sheet?

| Option | Verdict |
|---|---|
| `xlsx` (SheetJS, npm) | ❌ The npm build is abandoned — maintainer moved distribution to their own registry; the npm package carries unfixed high-severity advisories (ReDoS, prototype pollution). Parsing hostile user files with an unpatched parser is the exact wrong place to accept that. |
| `exceljs` | ✅ Actively maintained, ~1.9M weekly downloads, streaming reader ~6× lighter on memory than SheetJS for large sheets — relevant inside a memory-capped serverless function. Reads and writes .xlsx and CSV, which also covers sample-sheet generation. |
| CSV-only (no dependency) | ❌ as the only path — shopkeepers live in Excel, and "save as CSV first" is a support conversation per org. Kept as an *accepted input* since exceljs reads it anyway. |
| Embedded images in the sheet | ❌ technically extractable, but anchoring a floating image to "its" row is fragile in real files. Filename columns + a file-drop match step is deterministic and debuggable. |

Sources: SheetJS npm advisories and 2026 library comparisons (pkgpulse, mfyz
node-excel comparison), checked 2026-08-21.
