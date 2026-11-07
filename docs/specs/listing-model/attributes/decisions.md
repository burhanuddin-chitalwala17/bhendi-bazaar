# Decisions — listing-model / attributes

- **Verified:** 2026-11-08

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Binding here: parent [decisions](../decisions.md) Q5, Q6, Q8–Q10, Q16, Q19, Q20, Q25, Q26, Q29, Q33.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is this subfeature's one outcome? | One dictionary of attributes, answered once per product, with brand and shop filling theirs | Claude · reversible | 2026-11-07 | Parent Q14, step 3 | decided |
| Q2 | Does this subfeature have screens? | No; the form and brand page change in dynamic-form | Claude · reversible | 2026-11-07 | One outcome per subfeature (ADR-0061) | decided |
| Q3 | What becomes of today's 28 facts and 10 measurements? | Each becomes an attribute with the same key, so every map and answer carries across | Claude · reversible | 2026-11-07 | Same keys keep the move verifiable by count | implemented (unit 1) |
| Q4 | Today's "strap" (detachable or not) and Amazon's strap type? | Two attributes: "Strap: detachable" keeps today's answers; "Strap type" (Adjustable, Cross-body, Shoulder…) is new and starts empty | Owner | 2026-11-07 | Parent Q25 | decided |
| Q5 | Is a brand's product link an attribute? | Yes, a reference attribute; empty means the shop's default brand | Claude · reversible | 2026-11-07 | Parent Q10; one way to read every value | implemented (unit 1) |
| Q6 | Which attribute values does the shop's settings fill? | Country of origin (fallback after brand), GST % and HSN per category | Claude · reversible | 2026-11-07 | What OrgListingDefaults holds today; GST % finally used | decided |
| Q7 | How are value rows kept in step with today's answers until dynamic-form switches the writes? | A database trigger re-derives a product's value rows whenever its facts, measurements, weight, brand, type or org change, inside the same statement; brand and shop-default edits re-derive the products that inherit them. The repository stays the only application writer; dynamic-form reverses the direction and drops the trigger | Claude · reversible | 2026-11-08 | Facts are written at a dozen sites in catalog and listing; a trigger cannot miss one, which is what A3 (nothing lost) needs. Was: TRD D3's dual write from each save | implemented (unit 1) |
| Q8 | Where does the product's read copy of its values live? | In its own table (`ProductValueSet`, one row per product), written with the rows, not a column on Product | Claude · reversible | 2026-11-08 | A `Product.values` column written by listing would give Product two writers (Invariant 5); one keyed read costs the same. Was: TRD D3's `Product.values` | implemented (unit 1) |
| Q9 | A brand edit touching many products? | Re-derived in the brand's own statement by the trigger: every product of the brand, and the shop's brandless ones when it is the default (a product's own answers are re-read unchanged) | Claude · reversible | 2026-11-08 | A shop's brand holds hundreds of products, not millions; one statement keeps every product consistent the moment the brand saves. Was: TRD D5's job in batches of 500 | implemented (unit 1) |
| Q10 | A shop's own answer (a value a shop added to a list)? | An option row with the shop's id, as the list holds it today | Claude · reversible | 2026-11-08 | Same scoping as ListingValue, so nothing is lost in the move (R7) | implemented (unit 1) |
| Q11 | Packer and importer, while a brand has one "packer or importer" line? | Packer from that line; importer left empty until the brand's own parties (unit 2) say who imports | Claude · reversible | 2026-11-08 | A domestic brand's packer recorded as an importer would be false on every listing | implemented (unit 1) |
| Q12 | Lists and types change after the move. How do options and type questions keep up? | Triggers: a list value added or changed reaches every fact's options; a type made or edited rebuilds its questions, and a moved measure unit re-derives its products. An undeclared-unit measure, an unlisted answer, an overflowing number are kept as text | Claude · reversible | 2026-11-08 | The snapshot went stale the moment a shop added a colour; same mechanism as Q7, dropped with it | implemented (unit 1) |
| Q13 | A fact's marketplace source and unlisted flag? | Stay in `Product.facts` until dynamic-form, which adds them to the value row before retire-old-paths drops facts | Claude · reversible | 2026-11-08 | Nothing reads them from values yet; the form that shows "was Crepe from Amazon" is dynamic-form's | decided |

## Parked (Later)
- None.
