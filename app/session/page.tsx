import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/db';
import { assemblePracticeSession } from '@/lib/sessions';
import SessionRunner from '@/components/session/SessionRunner';

export default async function SessionPage() {
  const cookieStore = cookies();
  const supabase = getSupabaseServerClient({ getAll: () => cookieStore.getAll() });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders — middleware.ts already redirects unauthenticated
  // requests, but this route also renders server-side data keyed to a user.
  if (!user) {
    redirect('/login');
  }

  const plan = await assemblePracticeSession(supabase, user.id, 'practice');

  if (plan.items.length === 0) {
    return (
      <div className="text-center py-24 space-y-2">
        <h1 className="text-xl font-bold text-gray-900">No questions available yet</h1>
        <p className="text-sm text-gray-500">
          Import or generate validated questions from <code>/admin</code>, then start a session.
        </p>
      </div>
    );
  }

  return (
    <SessionRunner
      sessionId={plan.sessionId}
      items={plan.items}
      confidenceBuilderPool={plan.confidenceBuilderPool}
      plannedMinutes={plan.plannedMinutes}
      composition={plan.composition}
    />
  );
}
