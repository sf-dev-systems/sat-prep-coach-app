/**
 * lib/db/index.ts (modifications: added PracticeTest interface, CRUD database functions, Error Journal, and Skill Notes helpers)
 * Portable Supabase queries. Free of React or Next imports.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';

// Portable Supabase clients (no next/react dependencies)
export function getSupabaseClient(accessToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase URL and Anon Key are not defined in environment.');
  }

  if (accessToken) {
    return createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  return createClient(url, anonKey);
}

/**
 * Browser-side Supabase client that persists the auth session to cookies
 * (via @supabase/ssr) instead of localStorage, so server components and
 * middleware can read the same session. Use this in any 'use client'
 * component instead of getSupabaseClient().
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase URL and Anon Key are not defined in environment.');
  }

  return createBrowserClient(url, anonKey);
}

/**
 * Cookie adapter shape required by @supabase/ssr's createServerClient.
 * The caller (middleware.ts, or a Server Component/Route Handler under
 * app/) is responsible for supplying this from next/headers or the
 * request/response objects — this file stays free of any `next` import,
 * per the lib/ boundary rule.
 */
export interface ServerCookieMethods {
  getAll: () => { name: string; value: string }[];
  setAll?: (cookies: { name: string; value: string; options: Record<string, unknown> }[]) => void;
}

/**
 * Server-side Supabase client bound to request cookies. Used by
 * middleware.ts and any server component/route handler under app/ that
 * needs the authenticated user.
 */
export function getSupabaseServerClient(cookies: ServerCookieMethods): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase URL and Anon Key are not defined in environment.');
  }

  return createServerClient(url, anonKey, { cookies });
}

export function getSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase URL and Service Role Key are not defined in environment.');
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Database Interfaces
export interface Skill {
  id: string;
  section: 'rw' | 'math' | 'strategy';
  domain: string | null;
  name: string;
  parent_skill_id: string | null;
  weight: number | null;
}

export interface Question {
  id: string;
  skill_id: string | null;
  source: 'official' | 'generated';
  difficulty: number;
  stem: string;
  choices: string[] | null; // Null for math grid-ins
  correct_answer: string;
  rationale: string | null;
  distractor_notes: Record<string, string> | null;
  trap_type: string | null;
  license: string | null;
  external_id: string | null;
  validated: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  session_type: 'diagnostic' | 'practice' | 'review' | 'full_test_entry';
  questions_served: number;
  questions_correct: number;
  reflection: string | null;
}

export interface Attempt {
  id: string;
  user_id: string;
  question_id: string | null;
  skill_id: string | null;
  session_id: string | null;
  answer: string | null;
  is_correct: boolean | null;
  confidence: 'high' | 'medium' | 'low' | null;
  error_type: 'concept' | 'calculation' | 'misread' | 'careless' | 'timing' | 'guess' | null;
  time_spent_seconds: number | null;
  hints_used: number;
  was_retry: boolean;
  created_at: string;
}

export interface Mastery {
  user_id: string;
  skill_id: string;
  p_mastery: number;
  stability: number;
  attempts_count: number;
  last_practiced: string | null;
  next_review: string | null;
}

export interface PracticeTest {
  id: string;
  user_id: string;
  taken_at: string; // ISO date string YYYY-MM-DD
  total_score: number;
  rw_score: number;
  math_score: number;
  domain_breakdown: Record<string, number> | null;
}

export interface ErrorJournal {
  id: string;
  user_id: string;
  skill_id: string | null;
  ai_observation: string;
  student_note: string | null;
  created_at: string;
}

export interface SkillNote {
  user_id: string;
  skill_id: string;
  content: string;
  updated_at: string;
}

export interface Profile {
  user_id: string;
  display_name: string | null;
  plan: string;
  ai_daily_ceiling: number | null;
  created_at: string;
}

export interface AiLog {
  id: string;
  user_id: string;
  call_type: 'hint' | 'explanation' | 'variant' | 'classify' | 'report' | 'coach_update';
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface EventLog {
  id: string;
  user_id: string;
  event_type: 'session_start' | 'session_end' | 'milestone_hit' | 'report_viewed' | 'parent_viewed' | string;
  payload: any;
  created_at: string;
}

export interface TimeOfDayBucket {
  accuracy: number;
  avg_pace_seconds: number;
  n: number;
}

export interface BehaviorSignals {
  user_id: string;
  computed_at: string;
  avg_pace_by_difficulty: Record<string, number> | null;
  fatigue_minute: number | null;
  avg_focus_minutes: number | null;
  time_of_day_performance: Record<string, TimeOfDayBucket> | null;
  post_miss_accuracy: number | null;
  calibration_score: number | null;
}

/** Attempt row joined with its question's difficulty — nightly signals need
 * difficulty per-attempt (avg_pace_by_difficulty); attempts itself doesn't
 * store it, only question_id, so this is a join rather than a plain select. */
export interface AttemptWithDifficulty extends Attempt {
  difficulty: number | null;
}

// 3. Database Operations (Stateless & Portable)

export async function fetchSkills(supabase: SupabaseClient): Promise<Skill[]> {
  const { data, error } = await supabase.from('skills').select('*');
  if (error) throw error;
  return data as Skill[];
}

export async function fetchQuestionsBySkill(
  supabase: SupabaseClient,
  skillId: string,
  limit = 20
): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('skill_id', skillId)
    .limit(limit);
  if (error) throw error;
  return data as Question[];
}

/** Fallback pool for the session assembler when weighted skill selection can't fill the target count. */
export async function fetchValidatedQuestions(
  supabase: SupabaseClient,
  limit = 20
): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('validated', true)
    .limit(limit);
  if (error) throw error;
  return data as Question[];
}

export async function startPracticeSession(
  supabase: SupabaseClient,
  userId: string,
  sessionType: Session['session_type']
): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      session_type: sessionType,
      questions_served: 0,
      questions_correct: 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Session;
}

export async function endPracticeSession(
  supabase: SupabaseClient,
  sessionId: string,
  questionsServed: number,
  questionsCorrect: number,
  reflection: string | null = null
): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .update({
      ended_at: new Date().toISOString(),
      questions_served: questionsServed,
      questions_correct: questionsCorrect,
      reflection,
    })
    .eq('id', sessionId)
    .select('*')
    .single();

  if (error) throw error;
  return data as Session;
}

export async function logAttempt(
  supabase: SupabaseClient,
  attempt: Omit<Attempt, 'id' | 'created_at'>
): Promise<Attempt> {
  const { data, error } = await supabase
    .from('attempts')
    .insert(attempt)
    .select('*')
    .single();

  if (error) throw error;
  return data as Attempt;
}

export async function logAiCall(
  supabase: SupabaseClient,
  userId: string,
  callType: AiLog['call_type'],
  model: string,
  inputTokens: number | null,
  outputTokens: number | null
): Promise<AiLog> {
  const { data, error } = await supabase
    .from('ai_log')
    .insert({
      user_id: userId,
      call_type: callType,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as AiLog;
}

export async function countTodayAiCalls(supabase: SupabaseClient, userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('ai_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', today.toISOString());

  if (error) throw error;
  return count || 0;
}

export async function fetchUserProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is empty result code
  return data as Profile | null;
}

export async function logEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
  payload: any = null
): Promise<EventLog> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      user_id: userId,
      event_type: eventType,
      payload,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as EventLog;
}

export async function fetchConfig(supabase: SupabaseClient, key: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ? data.value : null;
}

export async function insertQuestions(supabase: SupabaseClient, questions: Omit<Question, 'id' | 'created_at'>[]): Promise<void> {
  const { error } = await supabase.from('questions').insert(questions);
  if (error) throw error;
}

/** Single question by id — used by app/api/miss-loop/route.ts to build hint/
 * explanation prompts server-side from the canonical row rather than trusting
 * a client-supplied question payload. */
export async function fetchQuestionById(supabase: SupabaseClient, questionId: string): Promise<Question | null> {
  const { data, error } = await supabase.from('questions').select('*').eq('id', questionId).maybeSingle();
  if (error) throw error;
  return data as Question | null;
}

/** Distinct question_ids this user has ever attempted for a skill — the
 * "not already served" exclusion set for PRD F3.3's structural-variant step. */
export async function fetchAttemptedQuestionIdsForSkill(
  supabase: SupabaseClient,
  userId: string,
  skillId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('attempts')
    .select('question_id')
    .eq('user_id', userId)
    .eq('skill_id', skillId);
  if (error) throw error;
  const ids = new Set<string>((data || []).map((r: { question_id: string | null }) => r.question_id).filter(Boolean) as string[]);
  return Array.from(ids);
}

/** PRD F3.3 structural variant: same skill, same trap_type, validated, not
 * already served to this user. Read-only against the shared `questions`
 * table (RLS: authenticated read-only) so this can be called directly from
 * the browser client inside MissLoop.tsx — no server route needed since no
 * Anthropic call is involved (Phase 2 scope: pull from the existing bank
 * only; live AI generation of new variants is PRD F9's admin pipeline,
 * Phase 4). Returns null if the bank has nothing left to serve — the miss
 * loop treats that as "skip this step, never block."
 */
export async function fetchVariantQuestion(
  supabase: SupabaseClient,
  skillId: string,
  trapType: string | null,
  excludeQuestionIds: string[]
): Promise<Question | null> {
  let query = supabase
    .from('questions')
    .select('*')
    .eq('skill_id', skillId)
    .eq('validated', true)
    .limit(5);

  query = trapType ? query.eq('trap_type', trapType) : query.is('trap_type', null);

  const { data, error } = await query;
  if (error) throw error;

  const exclude = new Set(excludeQuestionIds);
  const candidates = ((data as Question[]) || []).filter((q) => !exclude.has(q.id));
  return candidates[0] ?? null;
}

/** Newest `coach_memory` row's narrative for a user (append-only table —
 * newest row is the active narrative per schema invariant #9). Full F6
 * (weekly Sonnet-authored refresh) is Phase 3 scope and not built yet; this
 * read-only accessor exists now because the AI integration rules ("every
 * tutoring prompt includes... the active coach-memory narrative") apply to
 * F3's explanation calls today, not just F6's own build phase. Returns null
 * when the student has no coach_memory history yet (always true pre-Phase 3) —
 * callers should degrade to a neutral placeholder string, not fail.
 */
export async function fetchLatestCoachMemory(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('coach_memory')
    .select('narrative')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { narrative: string } | null)?.narrative ?? null;
}

export interface ErrorJournalEntry {
  user_id: string;
  skill_id: string | null;
  ai_observation: string;
  student_note?: string | null;
}

/** PRD F3.5: "always written into error_journal" — one row per resolved
 * miss loop, regardless of whether the student ever taps to view the
 * distractor breakdown. `student_note` is left unset here; F5 (Phase 3)
 * owns prompting the student to restate the rule and updating it. */
export async function insertErrorJournalEntry(supabase: SupabaseClient, entry: ErrorJournalEntry): Promise<void> {
  const { error } = await supabase.from('error_journal').insert({
    user_id: entry.user_id,
    skill_id: entry.skill_id,
    ai_observation: entry.ai_observation,
    student_note: entry.student_note ?? null,
  });
  if (error) throw error;
}

// ── mastery (lib/mastery is the orchestration layer; all raw table access
// for it lives here per the "DB access only via lib/db" invariant) ──

export async function fetchMasteryRow(
  supabase: SupabaseClient,
  userId: string,
  skillId: string
): Promise<Mastery | null> {
  const { data, error } = await supabase
    .from('mastery')
    .select('*')
    .eq('user_id', userId)
    .eq('skill_id', skillId)
    .maybeSingle();

  if (error) throw error;
  return data as Mastery | null;
}

export async function fetchMasteryRows(supabase: SupabaseClient, userId: string): Promise<Mastery[]> {
  const { data, error } = await supabase.from('mastery').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data as Mastery[]) || [];
}

export async function upsertMasteryRow(
  supabase: SupabaseClient,
  row: Mastery
): Promise<Mastery> {
  const { data, error } = await supabase
    .from('mastery')
    .upsert(row, { onConflict: 'user_id,skill_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data as Mastery;
}

/** Bulk-init default rows (diagnostic F1) — skips rows that already exist. */
export async function upsertMasteryRowsIgnoringDuplicates(
  supabase: SupabaseClient,
  rows: Mastery[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('mastery')
    .upsert(rows, { onConflict: 'user_id,skill_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function fetchRecentSessions(
  supabase: SupabaseClient,
  userId: string,
  limit = 30
): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Session[]) || [];
}

export async function fetchRecentAttempts(
  supabase: SupabaseClient,
  userId: string,
  limit = 200
): Promise<Attempt[]> {
  const { data, error } = await supabase
    .from('attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Attempt[]) || [];
}

// ── practice_tests (PRD F7) ──

export async function fetchPracticeTests(supabase: SupabaseClient, userId: string): Promise<PracticeTest[]> {
  const { data, error } = await supabase
    .from('practice_tests')
    .select('*')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false });
  if (error) throw error;
  return (data as PracticeTest[]) || [];
}

export async function insertPracticeTest(
  supabase: SupabaseClient,
  test: Omit<PracticeTest, 'id'>
): Promise<PracticeTest> {
  const { data, error } = await supabase
    .from('practice_tests')
    .insert(test)
    .select('*')
    .single();
  if (error) throw error;
  return data as PracticeTest;
}

export async function deletePracticeTest(supabase: SupabaseClient, id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('practice_tests')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── error_journal & skill_notes (PRD F5) ──

export async function fetchErrorJournal(supabase: SupabaseClient, userId: string): Promise<ErrorJournal[]> {
  const { data, error } = await supabase
    .from('error_journal')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ErrorJournal[]) || [];
}

export async function fetchSkillNotes(supabase: SupabaseClient, userId: string): Promise<SkillNote[]> {
  const { data, error } = await supabase
    .from('skill_notes')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return (data as SkillNote[]) || [];
}

export async function upsertSkillNote(supabase: SupabaseClient, note: SkillNote): Promise<SkillNote> {
  const { data, error } = await supabase
    .from('skill_notes')
    .upsert(note, { onConflict: 'user_id,skill_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as SkillNote;
}

// ── behavior_signals (PRD F4 nightly cron) ──

/** All user_ids with at least one session started since `sinceIso` — the
 * cron's "who to recompute signals for" query. Uses `sessions` rather than
 * `profiles` because a profile can exist before any real activity does. */
export async function fetchActiveUserIds(supabase: SupabaseClient, sinceIso: string): Promise<string[]> {
  const { data, error } = await supabase.from('sessions').select('user_id').gte('started_at', sinceIso);
  if (error) throw error;
  const ids = new Set<string>((data || []).map((r: { user_id: string }) => r.user_id));
  return Array.from(ids);
}

/** Attempts since `sinceIso`, joined with each attempt's question difficulty,
 * ascending by time (nightly signal computation walks sessions chronologically). */
export async function fetchAttemptsSince(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string
): Promise<AttemptWithDifficulty[]> {
  const { data, error } = await supabase
    .from('attempts')
    .select('*, questions(difficulty)')
    .eq('user_id', userId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data as any[]) || []).map((row) => ({
    ...row,
    difficulty: row.questions?.difficulty ?? null,
  }));
}

export async function fetchSessionsSince(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string
): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('started_at', sinceIso)
    .order('started_at', { ascending: true });

  if (error) throw error;
  return (data as Session[]) || [];
}

export async function fetchBehaviorSignals(supabase: SupabaseClient, userId: string): Promise<BehaviorSignals | null> {
  const { data, error } = await supabase.from('behavior_signals').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as BehaviorSignals | null;
}

export async function upsertBehaviorSignals(
  supabase: SupabaseClient,
  row: Omit<BehaviorSignals, 'computed_at'>
): Promise<BehaviorSignals> {
  const { data, error } = await supabase
    .from('behavior_signals')
    .upsert({ ...row, computed_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data as BehaviorSignals;
}
