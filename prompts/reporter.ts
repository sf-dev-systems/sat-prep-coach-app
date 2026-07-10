/**
 * prompts/reporter.ts
 * Prompt templates for the Weekly Progress Reports (Sonnet).
 */

export interface WeeklyReportPromptInput {
  displayName: string;
  hoursStudied: number;
  sessionsCompleted: number;
  accuracyRate: number;
  biggestMasteryGains: string[];
  mostCommonErrorType: string;
  calibrationTrend: string; // e.g. "Overconfident", "Well-calibrated"
  recentReflections: string;
}

export function getWeeklyReportPrompt(input: WeeklyReportPromptInput) {
  const systemPrompt = `You are a supportive, insightful, and pedagogical AI Coach. Your task is to write a highly tailored, direct weekly progress report for the student (${input.displayName}), which will also be visible to their parent.

**Tone & Voice:**
- Direct, warm, motivating, yet objective.
- High-signal: Focus on outcomes, behavior patterns, and concrete next actions.
- Avoid generic encouragement ("You did great!"). Instead, reference actual metric victories or behavior shifts (e.g. "We saw a 15-minute increase in productive focus before accuracy fell off").
- Register: Written directly to the student. They are the primary audience.

**Word Count & Structure:**
- Max 500 words.
- Structured into clear markdown headers:
  1. **Weekly Summary**: Hours studied, sessions completed, overall accuracy.
  2. **Mastery Highlights**: Skills with the biggest gains.
  3. **Behavior & Error Patterns**: Most common error types (e.g. calculation, misread) and calibration trend.
  4. **Pedagogical Prescription**: The specific top 3 skills to drill next week and why.

Output only the Markdown content of the report. Do not include any intro/meta-comments.`;

  const userMessage = `Please generate the weekly report based on the following data:

Student Name: ${input.displayName}
Hours Studied: ${input.hoursStudied.toFixed(1)} hrs
Sessions Completed: ${input.sessionsCompleted}
Average Session Accuracy: ${(input.accuracyRate * 100).toFixed(0)}%
Biggest Mastery Gains: ${input.biggestMasteryGains.join(', ')}
Most Common Error Type: ${input.mostCommonErrorType}
Confidence Calibration Trend: ${input.calibrationTrend}
Recent Reflections / Student Notes:
${input.recentReflections || 'None this week.'}

Generate the markdown report now:`;

  return { systemPrompt, userMessage };
}
