# UX Decision System

This directory is the project's **source of truth for why the product is the way it is.**

It exists so that product decisions are not opinions we re-argue every week. Each
decision points at a principle; each principle points at evidence. When evidence
changes, we walk the chain forward and revise the decisions it invalidates.

## The chain

```
Evidence (E-*) -> Problem (PR-*) -> Principle (P-*) -> Decision (D-*) -> Implementation
     ^                                                            |
     +---------------- new measurement / user research -----------+
```

## Files

| File | Holds | Stable IDs |
|---|---|---|
| `01-evidence.md` | Every factual claim we rely on, with its source and date | `E-D##` data, `E-L##` literature, `E-M##` market |
| `02-problems.md` | Rider problems, ranked, each tied to evidence | `PR-##` |
| `03-principles.md` | Design rules derived from evidence | `P-##` |
| `04-personas.md` | Who we build for, grounded in evidence | `U-##` |
| `05-journeys.md` | What they are doing when they reach us | `J-##` |
| `06-decisions.md` | What we chose, why, and what would reverse it | `D-##` |
| `07-flows.md` | Screen-level flows, and where the machinery hides | `F-##` |
| `08-research.md` | The protocol that closes `D-08`, with verdicts pre-registered | `Q-#` |

## Rules of the system

1. **No orphan decisions.** Every `D-##` cites at least one `P-##`. Every `P-##`
   cites at least one `E-*`. A decision with no chain is a preference, and gets
   labelled as one.
2. **Evidence has an expiry.** Each `E-*` records when it was measured. Data-derived
   evidence is re-run against fresh TTC data; if a number moves materially, every
   decision downstream of it is flagged for review.
3. **Decisions record their kill condition.** Each `D-##` states what observation
   would make us reverse it. A decision nobody can imagine reversing is usually
   an unexamined assumption.
4. **Superseded, never deleted.** Decisions are marked `Superseded by D-##`, so the
   reasoning history survives.

## Status

*Updated 2026-09-02.*

Seeded 2026-08-28 from the data investigation in `01-evidence.md`. **41 decisions, 9
principles, 14 problems, 3 personas, 5 journeys and 4 flows**, each traceable to the
measurement that produced it. Two audits reversed the design they were written to confirm,
and both reversals are still in the log.

Three of the newest decisions (`D-39`–`D-41`) came from a single question — should the
planner show *fastest* and *most reliable* as separate options — and only one of them says
yes to anything. The other two record what measurement ruled out: a citywide comparison
label, and a percentage as the risk unit. `E-D26` additionally keeps a claim that **failed**
its own pre-registered test, along with the counting bug that produced it.

Personas remain **provisional** — derived from published research and our own delay
analysis, not yet from interviews with Toronto riders. Validating them is `D-08`, and it is
now the only thing this project is blocked on: everything buildable without a realtime feed
is built. The protocol is written and pre-registered in `08-research.md`.
