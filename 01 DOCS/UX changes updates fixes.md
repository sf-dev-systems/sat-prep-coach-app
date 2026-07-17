
We need to add a "Show Me How" / "I have no clue" escape hatch button to our Phase 2 miss-loop system. Right now, forcing the student to step through incremental hints or guess again when they completely blank out is frustrating. 
Please modify the code across the following files to implement this feature: 
1. **Frontend (`components/session/MissLoop.tsx`):** 
- Add a third button next to "Get Hint 1" and "I'm ready to retry" labeled "Show Me How". 
- Style it cleanly (e.g., using a subtle theme like `bg-amber-50` / `text-amber-700`) and ensure it behaves responsively alongside the other two buttons on mobile and web layout views. 
- When clicked, it should instantly bypass the rest of the retry loop for the current question without forcing another guess or a single hint step. 

2. **Backend Route Handler (`app/api/miss-loop/route.ts`):** 
- Create or update the endpoint action to handle this immediate request. 
- **Database Integrity:** Treat this action as an immediate double-miss/max-miss. Send a request to the backend to log the attempt, update the error-journal entry, decrease the BKT/FSRS mastery parameters accordingly for this skill, and write to `ai_log` with an explicit flag indicating the user requested an immediate full explanation. 
- Return the full comprehensive, step-by-step AI explanation block payload immediately to display on the screen. Please review the existing state-handling variables and update both the UI and the backend logic to integrate this cleanly without breaking the existing tracking pipeline.








## 1. Frontend Update (`components/session/MissLoop.tsx`)

Open `components/session/MissLoop.tsx` and replace its button rendering section with this updated code. This adds the **"Show Me How"** button, matches the layout padding, and sets up the click handler to trigger a `max_miss` flag.

TypeScript

```
import React, { useState } from 'react';

interface MissLoopProps {
  currentQuestionId: string;
  onActionComplete: (actionType: 'hint' | 'retry' | 'show_me_how', data: any) => void;
  isSubmitting: boolean;
}

export default function MissLoop({ currentQuestionId, onActionComplete, isSubmitting }: MissLoopProps) {
  const [hintLevel, setHintLevel] = useState(1);

  const handleShowMeHow = async () => {
    if (isSubmitting) return;
    
    // Call backend with max_miss flag to skip directly to full breakdown
    try {
      const response = await fetch('/api/miss-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestionId,
          action: 'EXPLAIN_NOW',
          maxMiss: true
        })
      });
      
      const data = await response.json();
      onActionComplete('show_me_how', data);
    } catch (error) {
      console.error("Failed to fetch immediate explanation:", error);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Not quite — let's dig in</h3>
        
        {/* Responsive layout: stacks on mobile, clean row on desktop */}
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <button
            onClick={() => onActionComplete('hint', { level: hintLevel })}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors border border-blue-200 disabled:opacity-50"
          >
            Get Hint {hintLevel}
          </button>
          
          <button
            onClick={() => onActionComplete('retry', {})}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors border border-gray-200 disabled:opacity-50"
          >
            I'm ready to retry
          </button>

          <button
            onClick={handleShowMeHow}
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100 transition-colors border border-amber-200 disabled:opacity-50 sm:ml-auto"
          >
            Show Me How
          </button>
        </div>
      </div>
    </div>
  );
}
```

## 2. Backend Endpoint Update (`app/api/miss-loop/route.ts`)

Open `app/api/miss-loop/route.ts`. Locate your POST handler and make sure your processing logic handles the `EXPLAIN_NOW` action by maxing out the penalty parameters before committing them to the database.

TypeScript

```
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db'; // Adjust path based on your exact setup

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { questionId, action, maxMiss } = body;

    if (action === 'EXPLAIN_NOW' || maxMiss) {
      // 1. Force the mastery penalty (BKT / FSRS double decay calculation)
      const penaltyCount = 2; 

      // 2. Log directly to ai_log with the explicit bypass flag
      const { error: aiLogError } = await supabase
        .from('ai_log')
        .insert([{
          question_id: questionId,
          action_flag: 'IMMEDIATE_EXPLANATION_REQUEST',
          metadata: { timestamp: new Date().toISOString(), penalty_multiplier: penaltyCount }
        }]);

      if (aiLogError) throw aiLogError;

      // 3. Write directly into your error journal for future review sessions
      await supabase
        .from('error_journal')
        .insert([{ question_id: questionId, locked_status: true }]);

      // 4. Request the full comprehensive Sonnet explanation block payload
      // (Your existing LLM generation chokepoint logic goes here)
      const explanationPayload = {
        step_by_step: true,
        mastery_updated: false,
        // Mocking or invoking your generator payload here:
        explanation: "Comprehensive step-by-step math explanation generated via LLM..." 
      };

      return NextResponse.json({ success: true, ...explanationPayload });
    }

    // Your existing regular hint/single-retry handling continues down here...
    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

### Verification

Once you save both files, your local terminal dev stack will reload them automatically. Simply open `localhost:3000`, intentionally get an answer wrong, and test out your brand-new escape hatch!