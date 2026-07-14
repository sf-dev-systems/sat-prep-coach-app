/**
 * prompts/tutor.ts
 * Prompt templates for the AI Tutor (Sonnet).
 */

export interface TutorPromptInput {
  stem: string;
  choices: string[] | null;
  studentAnswer: string;
  correctAnswer: string;
  rationale: string | null;
  confidence: 'high' | 'medium' | 'low';
  coachMemory: string;
  varkProfile: string; // "Read/Write 13, Kinesthetic 14..."
  /** Grounds "name the specific trap" in the question's own authored data
   * (questions.trap_type / distractor_notes[studentAnswer]) rather than
   * leaving the model to invent one — PRD F3.3's retry-wrong written
   * explanation step. Optional so this prompt still works for ad-hoc
   * tutor calls that don't have a graded question row on hand. */
  trapType?: string | null;
  chosenDistractorNote?: string | null;
}

export function getTutorPrompt(input: TutorPromptInput) {
  const systemPrompt = `You are a world-class AI SAT Tutor, a personal coach helping one student target a perfect 1600.
Your instruction style must align strictly with the student's VARK profile:
- **VARK Profile Directive:** ${input.varkProfile}
- Design Consequences: Keep explanations in clear, structured, written prose.
- IMMEDIATE CORRECTION-BY-DOING: Every wrong answer must be corrected by doing. Keep passive blocks of text to a single paragraph. Make the student think and act.
- Incorporate active learning checks.
- Do not provide a flat formula; explain the generalizable concept.

**Coach Memory Context:**
${input.coachMemory}

**This is PRD F3.3's retry-wrong written explanation — it has strict, locked requirements:**
1. **Maximum 150 words.** Not 150-200 — 150 is the hard ceiling.
2. **Must explicitly name the specific trap in the student's chosen answer** — say what made that exact choice tempting, not a generic "that's incorrect." Use the trap-type/distractor context provided below if given.
3. **Must end with the generalizable rule in exactly one sentence** — a standalone takeaway the student can apply to any future question of this pattern, not just this one. Make this closing sentence clearly set apart (its own short final line).
4. Do not reveal the correct answer choice/value if it isn't already implied by walking through the trap — the goal is understanding the trap, not a spoiler recap.

**Guidelines:**
1. Be encouraging, concise, and direct.
2. Refer to previous concepts when relevant, using the coach memory context.
3. One paragraph of trap-explanation prose, then the one-sentence generalizable rule on its own line. No confirmation-check question after it — the miss loop serves a structural variant next to confirm the fix by doing, not by talking.`;

  const userMessage = `The student answered a question. Here are the details:

Question Stem:
${input.stem}

Choices:
${input.choices ? input.choices.map((c, i) => `${String.fromCharCode(65 + i)}) ${c}`).join('\n') : 'Student-produced response (Math grid-in)'}

Student's Answer: ${input.studentAnswer}
Correct Answer: ${input.correctAnswer}
Confidence Level: ${input.confidence}
Question Rationale: ${input.rationale || 'Not provided'}
Trap Type: ${input.trapType || 'Not tagged — infer the likely trap from the choices and rationale.'}
Why the student's chosen answer is tempting: ${input.chosenDistractorNote || 'Not authored for this choice — infer from the rationale.'}

Write the explanation per the locked requirements above: name the specific trap in the student's chosen answer, then end with the generalizable rule in one sentence.`;

  return { systemPrompt, userMessage };
}
