import MissLoopReview from "../components/MissLoopReview";

export const metadata = {
  title: "Miss Loop Review | SAT Prep",
  description: "Review your missed questions using spaced repetition.",
};

export default function MissLoopPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
            Targeted Review
          </h1>
          <p className="mt-3 text-xl text-gray-500 sm:mt-4">
            Master the concepts you missed to boost your score.
          </p>
        </div>
        
        <MissLoopReview />
      </div>
    </main>
  );
}
