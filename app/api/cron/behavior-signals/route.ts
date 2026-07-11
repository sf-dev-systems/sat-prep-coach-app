import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/db';
import { runNightlyBehaviorSignalsJob } from '@/lib/scoring/nightly';

/**
 * Vercel Cron target for PRD F4's nightly behavior_signals job. Schedule is
 * configured in vercel.json ("crons"). This route is hit unattended by
 * Vercel's scheduler, not by a logged-in student — so there is no user
 * session to derive identity from, and it authenticates via CRON_SECRET
 * instead (set in Vercel env + .env.local; Vercel automatically attaches
 * `Authorization: Bearer $CRON_SECRET` to its own cron invocations once
 * that env var exists on the project).
 *
 * This is the one deliberate exception to schema invariant #5 ("no
 * hardcoded user ID anywhere; identity from auth session only"): the
 * service-role client here iterates every active user by design, because a
 * nightly recompute job has no single user to scope to. Every other route
 * in this app must still derive identity from the session.
 *
 * Always returns 200 with a per-user error list rather than 500 on partial
 * failure — the job already degrades per-user internally (see
 * lib/scoring/nightly.ts), so a route-level 500 here would misleadingly
 * suggest total failure to Vercel's cron monitoring when most users
 * probably succeeded.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const result = await runNightlyBehaviorSignalsJob(supabase);

  return NextResponse.json(result);
}
