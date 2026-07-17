"use client";

import { useState, useEffect } from "react";

// Types based on your Supabase schema
interface Question {
  id: string;
  stem: string;
  choices: string[];
  correct_answer: string;
  rationale: string;
}

interface MissedQuestionRecord {
  id: string;
  question_id: string;
  questions: Question;
  consecutive_correct: number;
}

export default function MissLoopReview() {
  const [reviewQueue, setReviewQueue] = useState<MissedQuestionRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    fetchReviewQueue();
  }, []);

  const fetchReviewQueue = async () => {
    try {
      const res = await fetch("/api/miss-loop");
      const { data } = await res.json();
      if (data) {
        setReviewQueue(data);
      }
    } catch (error) {
      console.error("Failed to load miss loop:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentRecord = reviewQueue[currentIndex];
  const currentQuestion = currentRecord?.questions;

  const handleSubmit = async () => {
    if (!selectedAnswer || !currentQuestion) return;

    // Convert A/B/C/D back to index if needed, or assume choices are matched by text/letter.
    // For this example, assuming correct_answer is 'A', 'B', 'C', or 'D' and choices array matches that order.
    const choiceLabels = ["A", "B", "C", "D"];
    const isCorrect = selectedAnswer === currentQuestion.correct_answer;

    setIsSubmitted(true);

    // Hit our new POST endpoint to update spaced repetition
    try {
      await fetch("/api/miss-loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          isCorrect,
        }),
      });
    } catch (error) {
      console.error("Failed to update spaced repetition:", error);
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setIsSubmitted(false);
    setCurrentIndex((prev) => prev + 1);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading your review queue...</div>;
  }

  if (reviewQueue.length === 0 || currentIndex >= reviewQueue.length) {
    return (
      <div className="p-8 text-center bg-green-50 rounded-xl border border-green-200">
        <h2 className="text-2xl font-bold text-green-700 mb-2">All Caught Up!</h2>
        <p className="text-green-600">You have zero missed questions due for review right now.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <h2 className="text-xl font-semibold">Miss Loop Review</h2>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {currentIndex + 1} / {reviewQueue.length} Due
        </span>
      </div>

      <div className="mb-8 text-lg text-gray-800 whitespace-pre-wrap">
        {currentQuestion.stem}
      </div>

      <div className="space-y-3 mb-8">
        {currentQuestion.choices && currentQuestion.choices.map((choice, idx) => {
          const letter = ["A", "B", "C", "D"][idx];
          const isSelected = selectedAnswer === letter;
          const isActuallyCorrect = currentQuestion.correct_answer === letter;
          
          let buttonStyles = "w-full text-left p-4 border rounded-lg transition-colors ";
          
          if (!isSubmitted) {
            buttonStyles += isSelected ? "bg-blue-50 border-blue-500 ring-1 ring-blue-500" : "hover:bg-gray-50 border-gray-200";
          } else {
            if (isActuallyCorrect) {
              buttonStyles += "bg-green-50 border-green-500 text-green-800 font-medium";
            } else if (isSelected && !isActuallyCorrect) {
              buttonStyles += "bg-red-50 border-red-500 text-red-800";
            } else {
              buttonStyles += "opacity-50 border-gray-200";
            }
          }

          return (
            <button
              key={idx}
              disabled={isSubmitted}
              onClick={() => setSelectedAnswer(letter)}
              className={buttonStyles}
            >
              <span className="font-semibold mr-3">{letter}.</span>
              {choice}
            </button>
          );
        })}
      </div>

      {!isSubmitted ? (
        <button
          onClick={handleSubmit}
          disabled={!selectedAnswer}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
        >
          Check Answer
        </button>
      ) : (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg ${selectedAnswer === currentQuestion.correct_answer ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            <h3 className="font-bold mb-1">
              {selectedAnswer === currentQuestion.correct_answer ? "Correct!" : "Incorrect"}
            </h3>
            <p className="text-sm">{currentQuestion.rationale}</p>
          </div>
          <button
            onClick={handleNext}
            className="w-full py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-lg transition-colors"
          >
            {currentIndex + 1 === reviewQueue.length ? "Finish Review" : "Next Question"}
          </button>
        </div>
      )}
    </div>
  );
}
