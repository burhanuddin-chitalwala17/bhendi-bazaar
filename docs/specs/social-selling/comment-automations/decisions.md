# Decisions — social-selling/comment-automations

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q7, Q30, Q31, Q39, Q53, Q66, Q79–Q81.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Where is a post's rule set? | On the post, when it is scheduled: the product(s), the keyword and the DM text (post-scheduling Q6). This subfeature reads them through social's public surface and adds no second place to set them | Claude · reversible | 2026-11-06 | One place to set a post's rule; parent Q53 | decided |
| Q2 | Is there also a shop-wide keyword rule, for any post? | Yes, one optional rule per shop: a keyword and a DM text, used for a comment on any of the shop's posts that has no rule of its own, including posts made in the Instagram app | Claude · reversible | 2026-11-06 | "Keyword replies" is in the parent's outcome; posts made outside Bhendi Bazaar still sell | decided |
| Q3 | How does a comment match a keyword? | The keyword appears as a whole word, ignoring case, accents and surrounding punctuation or emoji; "shop", "SHOP!" and "Shop 🙏" match, "shopping" does not. One keyword per rule, letters and digits only, 2–20 characters | Claude · reversible | 2026-11-06 | Buyers type loosely; whole-word stops false matches | decided |
| Q4 | What is the DM? | The rule's text as the shop last saved it: pre-filled with each product's name and link, rewritable to anything up to 1,000 characters (parent Q53). A product link placed in the text is our product page | Claude · reversible | 2026-11-06 | Instagram's text limit is 1,000; the link is the default because it sells | decided |
| Q5 | Is there a public reply too? | Optional per rule, off by default; when on, a short public reply under the comment, default "Sent you a DM 📩", rewritable up to 300 characters | Claude · reversible | 2026-11-06 | Tells other viewers how to get the link; off by default so nothing public goes unasked | decided |
| Q6 | How many DMs per comment? | One, ever. A comment is claimed once; a redelivered webhook or a retry sends nothing more (Meta allows one private reply per comment) | Claude · reversible | 2026-11-06 | Meta's rule, and the guard against double sends | decided |
| Q7 | How many DMs per person? | At most one per person per post; a second matching comment by the same person on the same post gets nothing | Claude · reversible | 2026-11-06 | Stops a buyer, or a bot, triggering a burst of DMs | decided |
| Q8 | What if the comment is older than 7 days by the time we act? | Nothing is sent and the comment is marked "too late" in the post's activity; Meta refuses a private reply after 7 days | Claude · reversible | 2026-11-06 | A state of what is In; Meta's window | decided |
| Q9 | What about the shop's own comments and replies? | Never answered: a comment by the shop's own account, or a reply within a thread, is ignored | Claude · reversible | 2026-11-06 | A shop typing its own keyword must not DM itself | decided |
| Q10 | What when Meta's rate limit is reached? | The send waits and retries with back-off; a burst on a viral post drains within Meta's limit (750 private replies an hour per post) and none is dropped while under 7 days old | Claude · reversible | 2026-11-06 | Research 2026-11-06 | decided |
| Q11 | What does the shop see? | On each post: the rule, a count of DMs sent today and in total, and the last 50 matches with their outcome (sent, failed with reason, too late, skipped as a repeat). The DM itself appears in the inbox thread like any reply, marked "Automatic" | Claude · reversible | 2026-11-06 | Enough to trust it works; the inbox is where conversations live (inbox-instagram) | decided |
| Q12 | Can a shop pause a rule? | Yes, per post and for the shop-wide rule; paused rules send nothing and keep their settings | Claude · reversible | 2026-11-06 | A shop out of stock or away needs a stop that loses nothing | decided |
| Q13 | Does a rule still fire when a named product is out of stock or archived? | Yes for out of stock (the link still opens, with its own out-of-stock state); for an archived product its link is dropped from the DM, and with no link left and the text unchanged from the suggestion, nothing is sent and the activity says why | Claude · reversible | 2026-11-06 | Never DM a dead link; never silently change words the shop wrote | decided |
| Q14 | Does this subfeature know Instagram? | No. It is `server/automations/`, consuming the neutral "comment received" job and sending through a reply port `channels` implements (parent Q7, Q79, Q80). Other platforms' comments would plug in the same way | Claude · reversible | 2026-11-06 | Parent Q7 | decided |
| Q15 | Is AI used to understand comments? | No: keyword match only (parent Q31) | Owner | 2026-11-06 | Parent Q31 | decided |

## Parked (Later)
- Q2 extension — several shop-wide rules (keyword → different DMs); one rule meets every acceptance here.
- Story-mention and story-reply automations; DMs that start from a story are inbox-instagram's.
