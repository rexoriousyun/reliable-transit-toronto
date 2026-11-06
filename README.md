# Reliable Transit — Toronto

A reliability-aware view of the TTC: not "how fast is this route" but **"how likely is it
to actually work, and where does it break."**

## The premise

Transit unreliability is not random. Ranking TTC stations by delay independently across
2025 and 2026 gives a Spearman correlation of **0.78** — bad places stay bad. That makes
unreliability predictable, and therefore routable.

Two findings shape the product:

- **The rider's wait is not the vehicle's delay.** Median bus headway gap during an
  incident is 26 minutes against 13 minutes of vehicle lateness; **83.8% of bus incidents
  carry the bunching signature.** Every public tool reports the smaller number.
- **Nobody publishes reliability below the route level.** Reliability-aware TTC routing
  already exists; segment-level reliability does not. That gap is the product.

## Where the reasoning lives

Product decisions are not re-argued from opinion. `docs/ux/` holds the chain:

```
Evidence -> Problem -> Principle -> Decision -> Implementation
```

Start at [`docs/ux/README.md`](docs/ux/README.md). Every decision cites a principle,
every principle cites evidence, and every decision records what would reverse it.

## Data sources

All public, all verified live 2026-08-28, no API keys required.

| Source | Use | Notes |
|---|---|---|
| TTC delay data (subway/bus/streetcar) | Historical reliability | Monthly refresh, current to 2026-07-31 |
| GTFS static | Network topology, geometry | 236 routes, 9,402 stops |
| GTFS-RT | Live positions, trip updates | Surface only — **no subway realtime** |

Known limits, treated as design constraints rather than footnotes: the subway has no
realtime feed, 34% of surface delay records cannot be geocoded, and 65% of delay records
are zero-minute non-events. See `docs/ux/01-evidence.md`.

## Status

**Built.** Every milestone `M0`–`M12` ships: ingestion, the segment reliability model, the
routing engine, reliability ranking, departure advice, day-of disruptions, step-free routing,
and a mobile-first app that plans a trip and explores a route. Six audits run with
pre-registered thresholds, 171 tests pass, and the whole thing runs as one container.

What is **not** done is validation. Every persona is provisional — derived from published
research and our own delay data, never from talking to a Toronto rider — and eight
pre-registered questions are waiting on sessions that have not happened (`D-08`,
`docs/ux/08-research.md`). It has also never been deployed: the image is built and verified
locally, but `fly deploy` needs an account.

`docs/STATE.md` is the anchor and is kept current.
