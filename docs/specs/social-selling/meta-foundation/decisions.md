# Decisions — social-selling/meta-foundation

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only
> implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q2, Q7, Q34.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What happens when an account removes our app inside Instagram or Meta, or a person asks Meta to delete their data? | Removal: Meta's deauthorize notice turns the connection Needs reconnecting at once, with the daily check as a backstop. Deletion: we delete that person's credentials and details from every connection holding them, answer Meta with a status link and confirmation code, and a public page shows the request's status by its code | Claude · reversible | 2026-11-22 | Meta's review requires both callbacks; both concern every connection, so they live here. Moved from connect-instagram Q10 | decided |
| Q2 | How long are Meta's raw events kept? | 30 days, then deleted; what each event caused (a message, a comment) is kept by the tool that owns it, under its own retention | Owner | 2026-11-22 | Long enough to prove each event was handled once and to debug a fault; no longer, since events carry personal data | decided |
