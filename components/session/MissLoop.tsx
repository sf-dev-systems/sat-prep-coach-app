/**
 * MissLoop: Pedagogical State Machine
 * Handles: Content Gap vs. Strategy Gap interventions.
 */
import React, { useState } from 'react';
import { classifyFailure, ClassificationResult } from '@/lib/ai/classifier';

export default function MissLoop({ question, userResponse, onRetry }: { 
  question: any, 
  userResponse: string, 
  onRetry: () => void 
}) {
  const [phase, setPhase] = useState<'ANALYSIS' | 'HINT' | 'RETRY' | 'EXPLANATION'>('ANALYSIS');
  const [analysis, setAnalysis] = useState<ClassificationResult | null>(null);

  const startLoop = async () => {
    const result = classifyFailure(userResponse, question);
    setAnalysis(result);
    setPhase('HINT');
  };

  return (
    <div className="miss-loop-container p-6 border rounded-lg shadow-sm">
      {phase === 'ANALYSIS' && <button onClick={startLoop}>Review Response</button>}
      
      {phase === 'HINT' && (
        <div className="hint-zone">
          <h3 className="font-bold">Pedagogical Insight: {analysis?.reasoning}</h3>
          <p>Try focusing on {analysis?.mode === 'STRATEGY_GAP' ? 'tactical execution' : 'core concept'} strategies.</p>
          <button onClick={() => setPhase('RETRY')}>View Hint</button>
        </div>
      )}

      {phase === 'RETRY' && (
        <button onClick={onRetry}>Try Again</button>
      )}
    </div>
  );
}
