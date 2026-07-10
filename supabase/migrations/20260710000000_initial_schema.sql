-- Initial schema migration for sat-prep-coach-app
-- Date: 2026-07-10

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- 1. Shared Content Tables
create table skills (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('rw','math','strategy')),
  domain text,
  name text not null,
  parent_skill_id uuid references skills(id) on delete cascade,
  weight numeric
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid references skills(id) on delete set null,
  source text not null check (source in ('official','generated')),
  difficulty int not null check (difficulty between 1 and 3),
  stem text not null,
  choices jsonb, -- null = student-produced response (math grid-in)
  correct_answer text not null,
  rationale text,
  distractor_notes jsonb, -- why each wrong choice is tempting
  trap_type text,
  license text default null,
  external_id text default null,
  validated boolean default false,
  created_at timestamptz default now()
);

-- 2. Student State Tables
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  session_type text not null check (session_type in ('diagnostic','practice','review','full_test_entry')),
  questions_served int not null default 0,
  questions_correct int not null default 0,
  reflection text -- optional free text, skippable
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references questions(id) on delete set null,
  skill_id uuid references skills(id) on delete set null,
  session_id uuid references sessions(id) on delete cascade,
  answer text,
  is_correct boolean,
  confidence text check (confidence in ('high','medium','low')),
  error_type text check (error_type in ('concept','calculation','misread','careless','timing','guess')),
  time_spent_seconds int,
  hints_used int default 0, -- 0..3 tiered hints consumed before answering
  was_retry boolean default false,
  created_at timestamptz default now()
);

create table mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  p_mastery numeric default 0.3,
  stability numeric default 1.0, -- FSRS memory stability (days)
  attempts_count int default 0,
  last_practiced timestamptz,
  next_review timestamptz,
  primary key (user_id, skill_id)
);

create table practice_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at date not null,
  total_score int not null,
  rw_score int not null,
  math_score int not null,
  domain_breakdown jsonb
);

create table error_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid references skills(id) on delete set null,
  ai_observation text,
  student_note text,
  created_at timestamptz default now()
);

create table skill_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  content text not null,
  updated_at timestamptz default now(),
  primary key (user_id, skill_id)
);

create table coach_memory ( -- APPEND-ONLY; newest row per user is active
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  narrative text not null, -- rolling summary, max ~600 words
  updated_at timestamptz default now()
);

create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_of date not null,
  content text not null,
  created_at timestamptz default now()
);

create table behavior_signals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  computed_at timestamptz default now(),
  avg_pace_by_difficulty jsonb,
  fatigue_minute int, -- session minute where accuracy drops off
  avg_focus_minutes int, -- typical productive session length before decline
  time_of_day_performance jsonb, -- accuracy/pace bucketed by hour
  post_miss_accuracy numeric, -- accuracy after 2+ consecutive misses
  calibration_score numeric -- confidence vs correctness alignment
);

create table ai_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  call_type text not null, -- hint|explanation|variant|classify|report|coach_update
  model text not null,
  input_tokens int,
  output_tokens int,
  created_at timestamptz default now()
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  plan text default 'founder',
  ai_daily_ceiling int, -- null = use env default
  created_at timestamptz default now()
);

create table config (
  key text primary key,
  value jsonb not null
);

create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null, -- session_start|session_end|milestone_hit|report_viewed|parent_viewed
  payload jsonb,
  created_at timestamptz default now()
);

-- Enable Row-Level Security on all tables
alter table skills enable row level security;
alter table questions enable row level security;
alter table sessions enable row level security;
alter table attempts enable row level security;
alter table mastery enable row level security;
alter table practice_tests enable row level security;
alter table error_journal enable row level security;
alter table skill_notes enable row level security;
alter table coach_memory enable row level security;
alter table weekly_reports enable row level security;
alter table behavior_signals enable row level security;
alter table ai_log enable row level security;
alter table profiles enable row level security;
alter table config enable row level security;
alter table events enable row level security;

-- Define RLS Policies

-- Shared Content Tables: Read-only for authenticated users
create policy "Select skills for authenticated users" on skills
  for select using (auth.role() = 'authenticated');

create policy "Select questions for authenticated users" on questions
  for select using (auth.role() = 'authenticated');

-- Config Table: Read-only for authenticated users
create policy "Select config for authenticated users" on config
  for select using (auth.role() = 'authenticated');

-- Student Owned Tables: Select, Insert, Update, Delete for the owning user
-- sessions
create policy "CRUD sessions for owner" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- attempts
create policy "CRUD attempts for owner" on attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- mastery
create policy "CRUD mastery for owner" on mastery
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- practice_tests
create policy "CRUD practice_tests for owner" on practice_tests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- error_journal
create policy "CRUD error_journal for owner" on error_journal
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- skill_notes
create policy "CRUD skill_notes for owner" on skill_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- coach_memory
create policy "CRUD coach_memory for owner" on coach_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- weekly_reports
create policy "CRUD weekly_reports for owner" on weekly_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- behavior_signals
create policy "CRUD behavior_signals for owner" on behavior_signals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ai_log
create policy "CRUD ai_log for owner" on ai_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profiles
create policy "CRUD profiles for owner" on profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- events
create policy "CRUD events for owner" on events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
