# Title Run

A single-player web game where UFC fans **draft a custom fighter from the best attributes of
real fighters**, then fight an endless, escalating run to win the belt and chase the
**longest title reign**.

## Core loop

1. **Draft** — roll a random real fighter, keep one of their stats into its matching slot;
   repeat until all 9 stats are filled.
2. **Fight** — pick one tactical intent each round; the sim resolves it from your stats vs.
   the opponent's, with Fight IQ tilting the odds.
3. **Reward** — after each win, take one small reward (bump a stat, re-roll a weak stat, or
   recover damage). Opponents scale up.
4. **Streak** — win the belt at fight 5 (5-round title bouts and defenses thereafter). A loss
   ends the run; your score is the length of your title reign.

## Documentation

- [Product Requirements (PRD)](docs/prd.md)

## Status

Pre-development — product spec is locked; implementation not yet started.
