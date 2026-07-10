---
title: Glossary
type: wiki
version: 1.0
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: false
related: ["PRD v1", "TAXONOMY.md"]
---

# Glossary

Plain-language definitions. Canonical schema lives in the PRD; this page
explains terms, it does not define behavior.

- **BKT (Bayesian Knowledge Tracing)** — model estimating the probability
  a skill is mastered (`p_mastery`), updated after each attempt.
- **FSRS** — spaced-repetition scheduler; tracks memory `stability` and
  sets each skill's `next_review`.
- **Coach memory** — rolling narrative the AI keeps about the student,
  injected into every tutoring prompt. Append-only.
- **Error taxonomy** — the six failure types tagged on a miss: concept,
  calculation, misread, careless, timing, guess.
- **Calibration** — alignment between stated confidence and correctness.
- **Readiness** — dashboard breakdown: content, timing, consistency,
  calibration.
- **Miss loop** — the non-skippable hint → retry → explanation → variant
  flow triggered by a wrong answer.
- **Strategy skills** — test-taking skills (Desmos, pacing, etc.) tracked
  in mastery/readiness but weighted 0 in score prediction.

_(Expand as the build proceeds.)_
