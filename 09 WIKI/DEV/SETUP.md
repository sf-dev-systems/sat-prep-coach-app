---
title: Dev Setup & Replication
type: wiki
version: 1.1
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: false
related: ["README.md", "OPERATIONS_MANUAL.md"]
---

# Dev Setup & Replication

This guide details the step-by-step process of standing up and replicating the **AI SAT Prep Coach (Personal Edition v1)** workspace from scratch.

---

## Prerequisites

Ensure you have the following installed on your machine:
- **Node.js:** v18+ (v24.11.1 recommended)
- **NPM:** v9+ (v11.6.2 recommended)
- **Git**

---

## 1. Initial Project Scaffolding & Setup

Clone the repository and enter the project folder:
```bash
git clone https://github.com/sf-dev-systems/sat-prep-coach-app.git
cd sat-prep-coach-app
```

---

## 2. Configuration of Secrets (.env.local)

Copy the environment template to create your local variables configuration:
```bash
cp .env.example .env.local
```

Open `.env.local` and enter your credentials. All secrets are gitignored and never committed:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project API URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anonymous API key (client-side safe).
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role key (server-side ONLY; bypasses RLS).
- `ANTHROPIC_API_KEY`: Your Anthropic Console API Key (Sonnet/Haiku access).
- `AI_DAILY_CEILING`: 150 (defaults to 150; sets daily maximum AI queries per user).
- `PARENT_PIN`: 4-digit PIN for parent dashboard access.

---

## 3. Dependency Installation

Install the required npm packages:
```bash
npm install
```

This installs core stack packages: Next.js (App Router, TS), Tailwind, Supabase Client/SSR wrappers, Anthropic SDK, Recharts, and TypeScript utilities.

---

## 4. Supabase Schema Migration

All database tables, constraints, and Row-Level Security (RLS) policies are managed through SQL migration scripts.

Apply the primary migration schema by executing it in the **Supabase SQL Editor** or via the Supabase CLI:
- **Migration Location:** `supabase/migrations/20260710000000_initial_schema.sql`

---

## 5. Seed Skill Taxonomy

Run the skill seeding script to populate the nested hierarchy of skills into the `skills` table in your Supabase database:
```bash
npm run seed-skills
```

This executes `scripts/seed-skills.ts` which populates the **Reading & Writing**, **Mathematics**, and **Test-Taking Strategy** skill tree nodes.

---

## 6. Official Question Bank Import

Import official Digital SAT questions from a JSON source bank mapping to the active skills schema:
```bash
npm run import-bank <path-to-json-file>
```

*(For example: `npm run import-bank ./questions.json`)*

---

## 7. Run Local Development Server

Launch the Next.js local development environment:
```bash
npm run dev
```

The application will be live at `http://localhost:3000`. You can log in, view the readiness dashboard, and start practice sessions!
