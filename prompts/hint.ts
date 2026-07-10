/**
 * prompts/hint.ts
 * Prompt templates for Tiered Hints (Sonnet).
 */

export interface HintPromptInput {
  stem: string;
  choices: string[] | null;
  correctAnswer: string;
  hintNumber: 1 | 2 | 3;
  varkProfile: string;
}

export function getHintPrompt(input: HintPromptInput) {
  let hintInstructions = '';

  switch (input.hintNumber) {
    case 1:
      hintInstructions = `Provide **Hint 1**: A slight nudge or keyword clue. It must be strictly **20 words or less**. Never mention the correct answer or point too directly to the method. Just nudge their focus in the right direction.`;
      break;
    case 2:
      hintInstructions = `Provide **Hint 2**: Point the student directly at the formula, rule, or method needed to solve this question. Do not reveal the exact answer, but explain how to apply the method. Keep it to one concise paragraph.`;
      break;
    case 3:
      hintInstructions = `Provide **Hint 3**: A near-walkthrough of the problem. Walk through the steps to solve a similar pattern, but **do not reveal the correct answer choice or final number**. Keep it focused, interactive, and brief.`;
      break;
  }

  const systemPrompt = `You are a world-class AI SAT Coach providing tiered micro-hints to a student who missed a question.
Your instruction style must align strictly with the student's VARK profile:
- **VARK Profile:** ${input.varkProfile}

Your goal is to help them solve it themselves.
**Crucial Rule:** NEVER reveal the correct answer (letter or value). The student must do the final work.

${hintInstructions}`;

  const userMessage = `Please generate the hint for the following question:

Question Stem:
${input.stem}

Choices:
${input.choices ? input.choices.map((c, i) => `${String.fromCharCode(65 + i)}) ${c}`).join('\n') : 'Student-produced response (Math grid-in)'}

Correct Answer: ${input.correctAnswer}

Give me Hint ${input.hintNumber} following the exact guidelines above.`;

  return { systemPrompt, userMessage };
}
