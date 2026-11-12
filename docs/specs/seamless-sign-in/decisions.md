# Decisions — seamless-sign-in

- **Verified:** 2026-11-12

> Shipped before decisions.md existed: D1–D12 are in `git show 431ed6e7:docs/specs/seamless-sign-in/trd.md` (ADR-0073).

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| D13 | Does signing in at checkout keep the address a guest typed? | Yes; signing out still clears it. Supersedes D10's clearing; its re-quote stands | Owner | 2026-11-12 | An order carries its address inline, so a guest's address needs no account id; clearing it made a buyer type it twice | implemented |
