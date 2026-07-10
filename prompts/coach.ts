/**
 * prompts/coach.ts
 * Prompt templates for updating the append-only Coach Memory (Sonnet).
 */

export interface CoachMemoryPromptInput {
  previousNarrative: string | null;
  newAttemptsSummary: string; // Summary of recent attempts, scores, and missed categories
  studentReflections: string; // Recent student reflections/notes
}

export function getCoachMemoryPrompt(input: CoachMemoryPromptInput) {
  const systemPrompt = `You are the core memory engine for the AI SAT Prep Coach.
Your task is to review the previous rolling coach narrative, analyze the student's recent performance/behavior/reflections, and write a brand-new updated narrative summary.

**Crucial Rules:**
1. The rolling summary must be **at most 600 words**.
2. It must focus heavily on:
   - Trajectory (overall growth or struggles)
   - Persistent error patterns (e.g. "gets distracted by answer choices that are factually true but irrelevant to the specific prompt question")
   - Resolved patterns (what they have successfully overcome)
   - Notable reflections / mindset shifts.
3. This narrative is injected directly into tutoring prompts, so make it highly specific, clear, and structured.
4. Keep the output as a pure markdown document. Do not include any meta-introductions or explanations. Just return the new narrative.`;

  const userMessage = `Please update the student's coach memory.

**Previous Coach Memory Narrative:**
${input.previousNarrative || 'No previous memory. This is the student\'s first week.'}

**Recent Attempts & Performance Data:**
${input.newAttemptsSummary}

**Recent Student Notes & Reflections:**
${input.studentReflections || 'None'}

Construct the updated ≤600-word rolling narrative below:`;

  return { systemPrompt, userMessage };
}
