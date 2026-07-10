/**
 * prompts/classifier.ts
 * Prompt templates for Error Classification and Observations (Haiku).
 */

export interface ClassifierPromptInput {
  stem: string;
  choices: string[] | null;
  correctAnswer: string;
  studentAnswer: string;
  rationale: string | null;
  studentErrorTag: string; // concept|calculation|misread|careless|timing|guess
}

export function getClassifierPrompt(input: ClassifierPromptInput) {
  const systemPrompt = `You are an expert SAT educational classifier. Your role is to analyze a student's incorrect attempt and determine the most likely true source of error from their response behavior.
Your classification choices are strictly limited to one of the following JSON format:
{
  "classified_error_type": "concept" | "calculation" | "misread" | "careless" | "timing" | "guess",
  "disagreement_rationale": "Brief 1-sentence explanation of why you classified this way, especially if you disagree with the student's self-tag."
}

**Classification definitions:**
- **concept:** Student doesn't understand the underlying grammar rule, math formula, or reading analysis technique.
- **calculation:** Arithmetic, algebraic manipulation, or basic math process error.
- **misread:** Misunderstood what the question stem was asking (e.g., solved for x instead of 2x, or selected a true statement instead of the main idea).
- **careless:** Made a silly error they know how to avoid (typo, punctuation slip) despite understanding the concept.
- **timing:** Rushed and guessed or made a panic mistake due to lack of time.
- **guess:** Blind guess.

Keep your entire response as valid JSON ONLY. Do not wrap in markdown codeblocks. Do not include any text before or after the JSON.`;

  const userMessage = `Analyze the incorrect attempt:

Question:
${input.stem}

Choices:
${input.choices ? input.choices.map((c, i) => `${String.fromCharCode(65 + i)}) ${c}`).join('\n') : 'Math grid-in'}

Correct Answer: ${input.correctAnswer}
Student's Chosen Answer: ${input.studentAnswer}
Rationale: ${input.rationale || 'N/A'}
Student's Self-Tag: ${input.studentErrorTag}

Provide your classification JSON:`;

  return { systemPrompt, userMessage };
}
