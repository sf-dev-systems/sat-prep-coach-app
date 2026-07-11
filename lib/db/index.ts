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
