---
title: SAT Skill Taxonomy
type: wiki
version: 1.1
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: false
related: ["PRD v1", "scripts/seed-skills.ts"]
---

# SAT Skill Taxonomy (as implemented)

This document represents the nested structural hierarchy of sections, domains, and individual leaf-level skills loaded into the system via `scripts/seed-skills.ts`.

---

## 1. Reading & Writing (Weight: 1.0)
The Reading & Writing section is composed of four primary domains, each weighted according to its impact on score prediction:

### Domain A: Information and Ideas (Weight: 0.26)
- **Central Ideas and Details:** Identify major arguments, key claims, and secondary support details.
- **Command of Evidence (Textual):** Identify text segment or excerpt that best supports a stated argument.
- **Command of Evidence (Quantitative):** Use tables, charts, or graphs to support textual claims.
- **Inferences:** Make logically sound deductions based on the provided passage.

### Domain B: Craft and Structure (Weight: 0.28)
- **Words in Context:** Determine the appropriate definition of a word based on surrounding passage content.
- **Text Structure and Purpose:** Evaluate the overall structural plan and strategic intent of a passage.
- **Cross-Text Connections:** Compare and contrast viewpoints between two related short texts.

### Domain C: Expression of Ideas (Weight: 0.20)
- **Rhetorical Synthesis:** Synthesize provided notes to achieve a specific rhetorical goal.
- **Transitions:** Choose the appropriate logical connector (e.g., however, consequently) between sentences.

### Domain D: Standard English Conventions (Weight: 0.26)
- **Boundaries (Punctuation):** Correctly resolve punctuation boundaries (commas, semicolons, dashes).
- **Form, Structure, and Sense:** Choose correct verb tenses, subject-verb agreement, and pluralization.

---

## 2. Mathematics (Weight: 1.0)
The Math section covers four primary areas of focus, heavily weighting foundational algebra and advanced algebraic structures:

### Domain A: Algebra (Weight: 0.35)
- **Linear Equations in 1 Variable:** Construct and solve single-variable linear models.
- **Linear Equations in 2 Variables:** Solve and model two-variable linear systems.
- **Linear Functions:** Define, evaluate, and interpret linear equations and tables.
- **Systems of 2 Linear Equations:** Find intersections, infinite solutions, or no-solution criteria.
- **Linear Inequalities:** Model and solve linear constraints and inequalities.

### Domain B: Advanced Math (Weight: 0.35)
- **Equivalent Expressions:** Manipulate exponents, radicals, rational expressions, and quadratics.
- **Nonlinear Equations:** Solve quadratic, exponential, and absolute value equations.
- **Nonlinear Functions:** Interpret graphs, factors, roots, and intercepts of nonlinear models.

### Domain C: Problem-Solving & Data Analysis (Weight: 0.15)
- **Ratios, Rates, and Proportions:** Calculate scale factors, ratios, and unit conversions.
- **Percentages:** Solve percentage growth, tax, decay, and comparative interest.
- **One-Variable Data:** Analyze mean, median, mode, range, standard deviation, and dot plots.
- **Two-Variable Data (Scatterplots):** Evaluate lines of best fit, correlations, and scatterplot trends.
- **Probability and Conditional Probability:** Calculate probabilities and conditional frequencies from data tables.

### Domain D: Geometry and Trigonometry (Weight: 0.15)
- **Area and Volume:** Solve standard geometry formulas for circles, polygons, cylinders, and cones.
- **Lines, Angles, and Triangles:** Apply similarity, congruence, angle theorems, and parallel line properties.
- **Right Triangles and Trigonometry:** Use Pythagorean theorem, sine, cosine, and tangent ratios.
- **Circles:** Find arc lengths, sector areas, and standard forms of circle equations.

---

## 3. Test-Taking Strategy (Weight: 0.0)
Strategy skills represent tactical behaviors tracked inside the mastery and readiness dashboards. They are excluded from content-based score predictions to preserve prediction integrity.

### Domain A: Test Taking (Weight: 0.0)
- **Desmos Techniques:** Efficiently plot, solve, and intersect using the built-in graphing calculator.
- **RW Annotation Method:** Mark up reading passages to pinpoint core ideas on the first pass.
- **Module Pacing:** Allocate time optimally across questions to avoid rushing near module boundaries.
- **Skip-and-Flag Discipline:** Bypass hard/time-consuming questions to secure easier points first.
- **Elimination Discipline:** Disprove and eliminate distractors to increase guessing accuracy.
- **Distractor Pattern Recognition:** Recognize common trap answers (true-but-irrelevant, out-of-scope).
- **Guessing Under Time Pressure:** Apply optimal guessing mechanics when under extreme time stress.
- **Grid-in Mechanics:** Understand syntax and rounding rules for math student-produced answers.
