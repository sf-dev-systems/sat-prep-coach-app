# System Architecture: Pedagogical Weighting & Score Prediction Model

This document serves as the canonical reference for the **Pedagogical Weighting Model** and score prediction mathematical formulas. This blueprint governs how the mastery engine (`lib/mastery/`) and scoring engine (`lib/scoring/`) calculate predictions and represent the Goal Tree.

---

## 1. Mathematical Taxonomy Tree Structure

The system represents knowledge as a strict three-level hierarchical directed acyclic tree of the format:
$$\text{Section} \longrightarrow \text{Domain} \longrightarrow \text{Skill}$$

This hierarchy is represented in the `skills` database table using a self-referencing foreign key `parent_skill_id`:
*   **Section Level:** `parent_skill_id` is `NULL`. (Math, Reading/Writing, Strategy).
*   **Domain Level:** `parent_skill_id` references the parent Section.
*   **Skill Level (Leaf nodes):** `parent_skill_id` references the parent Domain.

---

## 2. Pedagogical Weighting Assignments

Every leaf skill is assigned a fixed mathematical weight representing its statistical prominence on the Digital SAT. These weights are enforced in `scripts/seed-skills.ts` and are categorized below.

### Math Section (Content Weight: 1.0)
Math leaf skills are weighted heavily toward Algebra and Advanced Math (35% each), which represent the core scoring areas of the Digital SAT.

*   **Algebra (Domain Weight: 0.35)**
    *   `Linear Equations & Inequalities`: Weight = **10**
    *   `Systems of Equations`: Weight = **10**
*   **Advanced Math (Domain Weight: 0.35)**
    *   `Quadratics & Parabolas`: Weight = **12**
    *   `Polynomials & Non-linear Functions`: Weight = **12**
*   **Problem-Solving & Data Analysis (Domain Weight: 0.15)**
    *   `Ratios, Rates & Proportions`: Weight = **8**
    *   `Percentages`: Weight = **8**
    *   `Statistics & Probability`: Weight = **10**
*   **Geometry & Trigonometry (Domain Weight: 0.15)**
    *   `Area & Volume`: Weight = **7**
    *   `Triangles & Circles`: Weight = **8**
    *   `Trigonometry`: Weight = **5**

---

### Reading & Writing Section (Content Weight: 1.0)
Reading & Writing skills are balanced across textual analysis and English conventions.

*   **Information & Ideas (Domain Weight: 0.26)**
    *   `Central Ideas & Details`: Weight = **12**
    *   `Command of Evidence`: Weight = **15**
    *   `Inferences`: Weight = **10**
*   **Craft & Structure (Domain Weight: 0.28)**
    *   `Words in Context`: Weight = **12**
    *   `Text Structure & Purpose`: Weight = **10**
    *   `Cross-Text Connections`: Weight = **8**
*   **Expression of Ideas (Domain Weight: 0.20)**
    *   `Transitions`: Weight = **8**
    *   `Rhetorical Synthesis`: Weight = **7**
*   **Standard English Conventions (Domain Weight: 0.26)**
    *   `Boundaries (Punctuation)`: Weight = **10**
    *   `Form, Structure, & Sense`: Weight = **8**

---

### Strategy Section (Content Weight: 0.0)
Strategy skills represent pacing, interface fluency, and cognitive trap recognition. While tracked in the mastery model, they have **0 score predictive weight** to ensure content mastery drives score calculations. Instead, their weights reflect timing and efficiency variables.

*   **Time & Attention Management**
    *   `Module Pacing`: Weight = **0.10**
    *   `Skip-and-Return Discipline`: Weight = **0.08**
    *   `End-of-Module Triage`: Weight = **0.05**
*   **Interface & Tool Fluency**
    *   `Desmos Proficiency`: Weight = **0.12**
    *   `Digital Annotation`: Weight = **0.05**
    *   `Elimination Interface`: Weight = **0.05**
*   **Distractor Pattern Recognition**
    *   `Extreme Language Traps`: Weight = **0.08**
    *   `Half-Right / Half-Wrong Traps`: Weight = **0.10**
    *   `Scope & Relevance Traps`: Weight = **0.07**

---

## 3. Score Prediction Mathematical Model

The scoring engine calculates the student's predicted SAT score (scaled **400 to 1600**) in two parts (scaled **200 to 800** per section) by evaluating the mastery-weighted sum of leaf skills.

Let:
*   $P_i \in [0, 1]$ be the student's current Bayesian Knowledge Tracing mastery probability (`p_mastery`) for leaf skill $i$.
*   $W_i$ be the pedagogical weight assigned to leaf skill $i$.

### Section Score Calculation (Before Recalibration)

The raw weighted mastery index $M_{\text{section}}$ for a section (Math or Reading/Writing) is calculated as:

$$M_{\text{section}} = \frac{\sum_{i \in \text{Leaf Skills of Section}} (P_i \times W_i)}{\sum_{i \in \text{Leaf Skills of Section}} W_i}$$

The estimated Section Score $S_{\text{section}}$ is mapped to the SAT scale (ranging from 200 to 800) using a baseline linear curve:

$$S_{\text{section}} = 200 + (600 \times M_{\text{section}})$$

### Recalibration and Correction Factor (F7 Alignment)

Official practice tests entered on `/tests` (from Bluebook) act as anchors. Let $A_{\text{section}}$ be the actual scaled score obtained on the latest official test, and let $S_{\text{section, baseline}}$ be the calculated score at the moment the test was taken.

The **recalibration scale factor** (correction factor) $C_{\text{section}}$ is calculated as:

$$C_{\text{section}} = \frac{A_{\text{section}} - 200}{600 \times M_{\text{section, actual}}}$$

The real-time **recalibrated prediction score** is then dynamically adjusted as:

$$S_{\text{section, recalibrated}} = 200 + (600 \times M_{\text{section}} \times C_{\text{section}})$$

*Note: The overall composite predicted score is the sum of the two section scores, capped strictly between 400 and 1600.*

---

## 4. Mastery Calculation Model & Strategy Multiplier

The scoring engine implements a dual-layered calculation incorporating content mastery and tactical execution.

### Base Mastery ($M_b$)
The Base Mastery ($M_b$) represents the content proficiency of the student for a given section, calculated as the weighted average of all leaf skill mastery levels:

$$M_b = \frac{\sum_{i=1}^{n} (P_i \times W_i)}{\sum_{i=1}^{n} W_i}$$

Where:
*   $P_i$ is the student's BKT mastery probability (`p_mastery`) for leaf skill $i$.
*   $W_i$ is the pedagogical weight assigned to leaf skill $i$.

### The Strategy Multiplier Adjustment Factor
To mirror real SAT conditions—where flawless content knowledge can be compromised by poor pacing, tool under-utilization, or falling into distractor traps—the system applies an adjustment factor called the **Strategy Multiplier** ($\mu_{\text{strategy}}$).

Let $M_{\text{strat}} \in [0, 1]$ be the student's aggregate mastery across all strategy skills:

$$M_{\text{strat}} = \frac{\sum_{j \in \text{Strategy Skills}} (P_j \times W_j)}{\sum_{j \in \text{Strategy Skills}} W_j}$$

The Strategy Multiplier acts as a dampener or amplifier and is defined as:

$$\mu_{\text{strategy}} = 0.90 + 0.15 \times M_{\text{strat}}$$

### Final Adjusted Score Model
The final predicted section score (Math or Reading/Writing) combines Base Mastery with the Strategy Multiplier, bounded by the SAT scale:

$$S_{\text{section, adjusted}} = \max\left(200, \min\left(800, 200 + \left(600 \times M_b \times \mu_{\text{strategy}}\right)\right)\right)$$

*   **Worst Strategy ($M_{\text{strat}} = 0$):** Section score is dampened by $10\%$ ($\mu_{\text{strategy}} = 0.90$), representing a student who knows the content but fails due to pacing, careless traps, or lack of tool fluency.
*   **Perfect Strategy ($M_{\text{strat}} = 1.0$):** Section score is amplified by up to $5\%$ ($\mu_{\text{strategy}} = 1.05$), representing maximum efficiency, Desmos fluency, and trap avoidance.

