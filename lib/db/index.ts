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
 * middleware.ts and any server component/route handler under app/ that\n * needs the authenticated user.\n */
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
 * difficulty per-attempt (avg_pace_by_difficulty); attempts itself doesn't\n * store it, only question_id, so this is a join rather than a plain select. */\nexport interface AttemptWithDifficulty extends Attempt {\n  difficulty: number | null;\n}\n\n// 3. Database Operations (Stateless & Portable)\n\nexport async function fetchSkills(supabase: SupabaseClient): Promise<Skill[]> {\n  const { data, error } = await supabase.from('skills').select('*');\n  if (error) throw error;\n  return data as Skill[];\n}\n\nexport async function fetchQuestionsBySkill(\n  supabase: SupabaseClient,\n  skillId: string,\n  limit = 20\n): Promise<Question[]> {\n  const { data, error } = await supabase\n    .from('questions')\n    .select('*')\n    .eq('skill_id', skillId)\n    .limit(limit);\n  if (error) throw error;\n  return data as Question[];\n}\n\n/** Fallback pool for the session assembler when weighted skill selection can't fill the target count. */\nexport async function fetchValidatedQuestions(\n  supabase: SupabaseClient,\n  limit = 20\n): Promise<Question[]> {\n  const { data, error } = await supabase\n    .from('questions')\n    .select('*')\n    .eq('validated', true)\n    .limit(limit);\n  if (error) throw error;\n  return data as Question[];\n}\n\nexport async function startPracticeSession(\n  supabase: SupabaseClient,\n  userId: string,\n  sessionType: Session['session_type']\n): Promise<Session> {\n  const { data, error } = await supabase\n    .from('sessions')\n    .insert({\n      user_id: userId,\n      session_type: sessionType,\n      questions_served: 0,\n      questions_correct: 0,\n    })\n    .select('*')\n    .single();\n\n  if (error) throw error;\n  return data as Session;\n}\n\nexport async function endPracticeSession(\n  supabase: SupabaseClient,\n  sessionId: string,\n  questionsServed: number,\n  questionsCorrect: number,\n  reflection: string | null = null\n): Promise<Session> {\n  const { data, error } = await supabase\n    .from('sessions')\n    .update({\n      ended_at: new Date().toISOString(),\n      questions_served: questionsServed,\n      questions_correct: questionsCorrect,\n      reflection,\n    })\n    .eq('id', sessionId)\n    .select('*')\n    .single();\n\n  if (error) throw error;\n  return data as Session;\n}\n\nexport async function logAttempt(\n  supabase: SupabaseClient,\n  attempt: Omit<Attempt, 'id' | 'created_at'>\n): Promise<Attempt> {\n  const { data, error } = await supabase\n    .from('attempts')\n    .insert(attempt)\n    .select('*')\n    .single();\n\n  if (error) throw error;\n  return data as Attempt;\n}\n\nexport async function logAiCall(\n  supabase: SupabaseClient,\n  userId: string,\n  callType: AiLog['call_type'],\n  model: string,\n  inputTokens: number | null,\n  outputTokens: number | null\n): Promise<AiLog> {\n  const { data, error } = await supabase\n    .from('ai_log')\n    .insert({\n      user_id: userId,\n      call_type: callType,\n      model,\n      input_tokens: inputTokens,\n      output_tokens: outputTokens,\n    })\n    .select('*')\n    .single();\n\n  if (error) throw error;\n  return data as AiLog;\n}\n\nexport async function countTodayAiCalls(supabase: SupabaseClient, userId: string): Promise<number> {\n  const today = new Date();\n  today.setHours(0, 0, 0, 0);\n\n  const { count, error } = await supabase\n    .from('ai_log')\n    .select('*', { count: 'exact', head: true })\n    .eq('user_id', userId)\n    .gte('created_at', today.toISOString());\n\n  if (error) throw error;\n  return count || 0;\n}\n\nexport async function fetchUserProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {\n  const { data, error } = await supabase\n    .from('profiles')\n    .select('*')\n    .eq('user_id', userId)\n    .single();\n\n  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is empty result code\n  return data as Profile | null;\n}\n\nexport async function logEvent(\n  supabase: SupabaseClient,\n  userId: string,\n  eventType: string,\n  payload: any = null\n): Promise<EventLog> {\n  const { data, error } = await supabase\n    .from('events')\n    .insert({\n      user_id: userId,\n      event_type: eventType,\n      payload,\n    })\n    .select('*')\n    .single();\n\n  if (error) throw error;\n  return data as EventLog;\n}\n\nexport async function fetchConfig(supabase: SupabaseClient, key: string): Promise<any | null> {\n  const { data, error } = await supabase\n    .from('config')\n    .select('value')\n    .eq('key', key)\n    .single();\n\n  if (error && error.code !== 'PGRST116') throw error;\n  return data ? data.value : null;\n}\n\nexport async function insertQuestions(supabase: SupabaseClient, questions: Omit<Question, 'id' | 'created_at'>[]): Promise<void> {\n  const { error } = await supabase.from('questions').insert(questions);\n  if (error) throw error;\n}\n\n/** Single question by id — used by app/api/miss-loop/route.ts to build hint/\n * explanation prompts server-side from the canonical row rather than trusting\n * a client-supplied question payload. */\nexport async function fetchQuestionById(supabase: SupabaseClient, questionId: string): Promise<Question | null> {\n  const { data, error } = await supabase.from('questions').select('*').eq('id', questionId).maybeSingle();\n  if (error) throw error;\n  return data as Question | null;\n}\n\n/** Distinct question_ids this user has ever attempted for a skill — the\n * \"not already served\" exclusion set for PRD F3.3's structural-variant step. */\nexport async function fetchAttemptedQuestionIdsForSkill(\n  supabase: SupabaseClient,\n  userId: string,\n  skillId: string\n): Promise<string[]> {\n  const { data, error } = await supabase\n    .from('attempts')\n    .select('question_id')\n    .eq('user_id', userId)\n    .eq('skill_id', skillId);\n  if (error) throw error;\n  const ids = new Set<string>((data || []).map((r: { question_id: string | null }) => r.question_id).filter(Boolean) as string[]);\n  return Array.from(ids);\n}\n\n/** PRD F3.3 structural variant: same skill, same trap_type, validated, not\n * already served to this user. Read-only against the shared `questions`\n * table (RLS: authenticated read-only) so this can be called directly from\n * the browser client inside MissLoop.tsx — no server route needed since no\n * Anthropic call is involved (Phase 2 scope: pull from the existing bank\n * only; live AI generation of new variants is PRD F9's admin pipeline,\n * Phase 4). Returns null if the bank has nothing left to serve — the miss\n * loop treats that as \"skip this step, never block.\"\n */\nexport async function fetchVariantQuestion(\n  supabase: SupabaseClient,\n  skillId: string,\n  trapType: string | null,\n  excludeQuestionIds: string[]\n): Promise<Question | null> {\n  let query = supabase\n    .from('questions')\n    .select('*')\n    .eq('skill_id', skillId)\n    .eq('validated', true)\n    .limit(5);\n\n  query = trapType ? query.eq('trap_type', trapType) : query.is('trap_type', null);\n\n  const { data, error } = await query;\n  if (error) throw error;\n\n  const exclude = new Set(excludeQuestionIds);\n  const candidates = ((data as Question[]) || []).filter((q) => !exclude.has(q.id));\n  return candidates[0] ?? null;\n}\n\n/** Newest `coach_memory` row's narrative for a user (append-only table —\n * newest row is the active narrative per schema invariant #9). Full F6\n * (weekly Sonnet-authored refresh) is Phase 3 scope and not built yet; this\n * read-only accessor exists now because the AI integration rules (\"every\n * tutoring prompt includes... the active coach-memory narrative\") apply to\n * F3's explanation calls today, not just F6's own build phase. Returns null\n * when the student has no coach_memory history yet (always true pre-Phase 3) —\n * callers should degrade to a neutral placeholder string, not fail.\n */\nexport async function fetchLatestCoachMemory(supabase: SupabaseClient, userId: string): Promise<string | null> {\n  const { data, error } = await supabase\n    .from('coach_memory')\n    .select('narrative')\n    .eq('user_id', userId)\n    .order('updated_at', { ascending: false })\n    .limit(1)\n    .maybeSingle();\n  if (error) throw error;\n  return (data as { narrative: string } | null)?.narrative ?? null;\n}\n\nexport interface ErrorJournalEntry {\n  user_id: string;\n  skill_id: string | null;\n  ai_observation: string;\n  student_note?: string | null;\n}\n\n/** PRD F3.5: \"always written into error_journal\" — one row per resolved\n * miss loop, regardless of whether the student ever taps to view the\n * distractor breakdown. `student_note` is left unset here; F5 (Phase 3)\n * owns prompting the student to restate the rule and updating it. */\nexport async function insertErrorJournalEntry(supabase: SupabaseClient, entry: ErrorJournalEntry): Promise<void> {\n  const { error } = await supabase.from('error_journal').insert({\n    user_id: entry.user_id,\n    skill_id: entry.skill_id,\n    ai_observation: entry.ai_observation,\n    student_note: entry.student_note ?? null,\n  });\n  if (error) throw error;\n}\n\n// ── mastery (lib/mastery is the orchestration layer; all raw table access\n// for it lives here per the \"DB access only via lib/db\" invariant) ──\n\nexport async function fetchMasteryRow(\n  supabase: SupabaseClient,\n  userId: string,\n  skillId: string\n): Promise<Mastery | null> {\n  const { data, error } = await supabase\n    .from('mastery')\n    .select('*')\n    .eq('user_id', userId)\n    .eq('skill_id', skillId)\n    .maybeSingle();\n\n  if (error) throw error;\n  return data as Mastery | null;\n}\n\nexport async function fetchMasteryRows(supabase: SupabaseClient, userId: string): Promise<Mastery[]> {\n  const { data, error } = await supabase.from('mastery').select('*').eq('user_id', userId);\n  if (error) throw error;\n  return (data as Mastery[]) || [];\n}\n\nexport async function upsertMasteryRow(\n  supabase: SupabaseClient,\n  row: Mastery\n): Promise<Mastery> {\n  const { data, error } = await supabase\n    .from('mastery')\n    .upsert(row, { onConflict: 'user_id,skill_id' })\n    .select('*')\n    .single();\n\n  if (error) throw error;\n  return data as Mastery;\n}\n\n/** Bulk-init default rows (diagnostic F1) — skips rows that already exist. */\nexport async function upsertMasteryRowsIgnoringDuplicates(\n  supabase: SupabaseClient,\n  rows: Mastery[]\n): Promise<void> {\n  if (rows.length === 0) return;\n  const { error } = await supabase\n    .from('mastery')\n    .upsert(rows, { onConflict: 'user_id,skill_id', ignoreDuplicates: true });\n  if (error) throw error;\n}\n\nexport async function fetchRecentSessions(\n  supabase: SupabaseClient,\n  userId: string,\n  limit = 30\n): Promise<Session[]> {\n  const { data, error } = await supabase\n    .from('sessions')\n    .select('*')\n    .eq('user_id', userId)\n    .order('started_at', { ascending: false })\n    .limit(limit);\n\n  if (error) throw error;\n  return (data as Session[]) || [];\n}\n\nexport async function fetchRecentAttempts(\n  supabase: SupabaseClient,\n  userId: string,\n  limit = 200\n): Promise<Attempt[]> {\n  const { data, error } = await supabase\n    .from('attempts')\n    .select('*')\n    .eq('user_id', userId)\n    .order('created_at', { ascending: false })\n    .limit(limit);\n\n  if (error) throw error;\n  return (data as Attempt[]) || [];\n}\n\n// ── practice_tests (PRD F7) ──\n\nexport async function fetchPracticeTests(supabase: SupabaseClient, userId: string): Promise<PracticeTest[]> {\n  const { data, error } = await supabase\n    .from('practice_tests')\n    .select('*')\n    .eq('user_id', userId)\n    .order('taken_at', { ascending: false });\n  if (error) throw error;\n  return (data as PracticeTest[]) || [];\n}\n\nexport async function insertPracticeTest(\n  supabase: SupabaseClient,\n  test: Omit<PracticeTest, 'id'>\n): Promise<PracticeTest> {\n  const { data, error } = await supabase\n    .from('practice_tests')\n    .insert(test)\n    .select('*')\n    .single();\n  if (error) throw error;\n  return data as PracticeTest;\n}\n\nexport async function deletePracticeTest(supabase: SupabaseClient, id: string, userId: string): Promise<void> {\n  const { error } = await supabase\n    .from('practice_tests')\n    .delete()\n    .eq('id', id)\n    .eq('user_id', userId);\n  if (error) throw error;\n}\n\n// ── error_journal & skill_notes (PRD F5) ──\n\nexport async function fetchErrorJournal(supabase: SupabaseClient, userId: string): Promise<ErrorJournal[]> {\n  const { data, error } = await supabase\n    .from('error_journal')\n    .select('*')\n    .eq('user_id', userId)\n    .order('created_at', { ascending: false });\n  if (error) throw error;\n  return (data as ErrorJournal[]) || [];\n}\n\nexport async function fetchSkillNotes(supabase: SupabaseClient, userId: string): Promise<SkillNote[]> {\n  const { data, error } = await supabase\n    .from('skill_notes')\n    .select('*')\n    .eq('user_id', userId);\n  if (error) throw error;\n  return (data as SkillNote[]) || [];\n}\n\nexport async function upsertSkillNote(supabase: SupabaseClient, note: SkillNote): Promise<SkillNote> {\n  const { data, error } = await supabase\n    .from('skill_notes')\n    .upsert(note, { onConflict: 'user_id,skill_id' })\n    .select('*')\n    .single();\n  if (error) throw error;\n  return data as SkillNote;\n}\n\n// ── behavior_signals (PRD F4 nightly cron) ──\n\n/** All user_ids with at least one session started since `sinceIso` — the\n * cron's \"who to recompute signals for\" query. Uses `sessions` rather than\n * `profiles` because a profile can exist before any real activity does. */\nexport async function fetchActiveUserIds(supabase: SupabaseClient, sinceIso: string): Promise<string[]> {\n  const { data, error } = await supabase.from('sessions').select('user_id').gte('started_at', sinceIso);\n  if (error) throw error;\n  const ids = new Set<string>((data || []).map((r: { user_id: string }) => r.user_id));\n  return Array.from(ids);\n}\n\n/** Attempts since `sinceIso`, joined with each attempt's question difficulty,\n * ascending by time (nightly signal computation walks sessions chronologically). */\nexport async function fetchAttemptsSince(\n  supabase: SupabaseClient,\n  userId: string,\n  sinceIso: string\n): Promise<AttemptWithDifficulty[]> {\n  const { data, error } = await supabase\n    .from('attempts')\n    .select('*, questions(difficulty)')\n    .eq('user_id', userId)\n    .gte('created_at', sinceIso)\n    .order('created_at', { ascending: true });\n\n  if (error) throw error;\n  return ((data as any[]) || []).map((row) => ({\n    ...row,\n    difficulty: row.questions?.difficulty ?? null,\n  }));\n}\n\nexport async function fetchSessionsSince(\n  supabase: SupabaseClient,\n  userId: string,\n  sinceIso: string\n): Promise<Session[]> {\n  const { data, error } = await supabase\n    .from('sessions')\n    .select('*')\n    .eq('user_id', userId)\n    .gte('started_at', sinceIso)\n    .order('started_at', { ascending: true });\n\n  if (error) throw error;\n  return (data as Session[]) || [];\n}\n\nexport async function fetchBehaviorSignals(supabase: SupabaseClient, userId: string): Promise<BehaviorSignals | null> {\n  const { data, error } = await supabase.from('behavior_signals').select('*').eq('user_id', userId).maybeSingle();\n  if (error) throw error;\n  return data as BehaviorSignals | null;\n}\n\nexport async function upsertBehaviorSignals(\n  supabase: SupabaseClient,\n  row: Omit<BehaviorSignals, 'computed_at'>\n): Promise<BehaviorSignals> {\n  const { data, error } = await supabase\n    .from('behavior_signals')\n    .upsert({ ...row, computed_at: new Date().toISOString() }, { onConflict: 'user_id' })\n    .select('*')\n    .single();\n\n  if (error) throw error;\n  return data as BehaviorSignals;\n}\n