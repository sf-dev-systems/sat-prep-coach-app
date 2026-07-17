# System Architecture: Pedagogical Weighting Model

## 1. Pedagogical Weighting Model
*   **Weighted Mastery Calculation**: The system calculates the base mastery ($M_b$) using the sum of individual skill mastery levels multiplied by their respective domain-specific weights: 
    $$M_b = \sum_{i=1}^{n} (Mastery_i \times Weight_i)$$
*   **Strategy Multiplier**: The Strategy section (Domain: Time Management, Interface Fluency, Distractor Recognition) acts as a dampener or amplifier on the overall score, ensuring that mastery in content (Math/RW) is appropriately balanced by the student's ability to execute under test conditions.
*   **Weight Baseline**:
    *   **Math**: High-impact foundational skills (e.g., Algebra, Advanced Math) are assigned a weight of **8–12**.
    *   **RW**: Critical comprehension skills (e.g., Command of Evidence, Words in Context) are assigned a weight of **8–15**.
    *   **Strategy**: Tactical execution skills (e.g., Module Pacing, Desmos Proficiency) are assigned specialized fractional weights (**0.05–0.12**) to modulate the primary mastery score without overriding core content knowledge.