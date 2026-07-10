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

**Guidelines:**
1. Be encouraging, concise, and direct.
2. Structure your response into clear, focused sections.
3. Refer to previous concepts when relevant, using the coach memory context.
4. Do not exceed 150-200 words. Keep it punchy!`;

  const userMessage = `The student answered a question. Here are the details:

Question Stem:
${input.stem}

Choices:
${input.choices ? input.choices.map((c, i) => `${String.fromCharCode(65 + i)}) ${c}`).join('\n') : 'Student-produced response (Math grid-in)'}

Student's Answer: ${input.studentAnswer}
Correct Answer: ${input.correctAnswer}
Confidence Level: ${input.confidence}
Question Rationale: ${input.rationale || 'Not provided'}

Explain why the student's answer is incorrect, identify the specific trap type if possible, and guide them to understand the correct concept without giving away answers directly. Use one-paragraph prose maximum before asking a confirmation check question.`;

  return { systemPrompt, userMessage };
}
