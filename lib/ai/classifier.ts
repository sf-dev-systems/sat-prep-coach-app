/**
 * lib/ai/classifier.ts
 * Core AI classification types and logic.
 * No framework (React/Next) imports are permitted under lib/.
 */

export interface ClassificationResult {
  mode: 'CONTENT_GAP' | 'STRATEGY_GAP';
  reasoning: string;
}

/**
 * Basic failure classification for SAT incorrect attempts.
 * Classifies whether the miss stems from a Content Gap or a Strategy Gap.
 */
export function classifyFailure(userResponse: string, question: any): ClassificationResult {
  const normResponse = userResponse ? userResponse.toLowerCase().trim() : '';
  
  // Strategy gaps are typically pacing, timing, guessing, or strategy-specific questions
  const isStrategySection = question?.section === 'strategy';
  const isStrategyTag = ['timing', 'guess'].includes(normResponse);

  if (isStrategySection || isStrategyTag) {
    return {
      mode: 'STRATEGY_GAP',
      reasoning: 'Tactical execution, time management, or interface usage error identified.',
    };
  }

  return {
    mode: 'CONTENT_GAP',
    reasoning: 'Underlying conceptual gap or skill-rule understanding error identified.',
  };
}
