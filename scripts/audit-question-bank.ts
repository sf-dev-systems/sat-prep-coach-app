/**
 * scripts/audit-question-bank.ts
 * Audits the question bank for data quality issues.
 * Usage: npm run audit:question-bank
 *
 * Exit 0: no severe issues (warnings only).
 * Exit 1: at least one severe issue found (missing skill_id, missing correct_answer, invalid difficulty).
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually — tsx doesn't auto-load it
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface AuditIssue {
  severity: 'SEVERE' | 'WARN'
  questionId: string
  externalId: string | null
  issue: string
}

async function fetchAllQuestions() {
  const PAGE_SIZE = 1000
  const all: Record<string, unknown>[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, external_id, skill_id, difficulty, choices, correct_answer, rationale, validated, source, skills(id, section)')
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('Failed to fetch questions:', error.message)
      process.exit(1)
    }

    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

async function main() {
  console.log('Fetching questions...')

  const questions = await fetchAllQuestions()

  if (!questions || questions.length === 0) {
    console.log('No questions found in database.')
    process.exit(0)
  }

  console.log(`Auditing ${questions.length} questions...\n`)

  const issues: AuditIssue[] = []

  // Track external_id occurrences for duplicate detection
  const externalIdMap = new Map<string, string[]>()

  for (const q of questions) {
    const id = q.id as string
    const extId = (q.external_id as string | null) ?? null

    if (extId) {
      const existing = externalIdMap.get(extId) ?? []
      existing.push(id)
      externalIdMap.set(extId, existing)
    }

    // SEVERE: missing skill_id
    if (!q.skill_id) {
      issues.push({ severity: 'SEVERE', questionId: id, externalId: extId, issue: 'Missing skill_id (orphaned question)' })
    }

    // SEVERE: skill_id FK doesn't resolve (left join returned null skills row)
    if (q.skill_id && q.skills === null) {
      issues.push({ severity: 'SEVERE', questionId: id, externalId: extId, issue: `skill_id ${q.skill_id} references nonexistent skill` })
    }

    // SEVERE: difficulty outside [1, 3]
    const diff = q.difficulty as number | null
    if (diff === null || diff < 1 || diff > 3) {
      issues.push({ severity: 'SEVERE', questionId: id, externalId: extId, issue: `difficulty ${diff} is outside [1, 3]` })
    }

    // SEVERE: missing correct_answer
    if (!q.correct_answer) {
      issues.push({ severity: 'SEVERE', questionId: id, externalId: extId, issue: 'Missing correct_answer' })
    }

    // WARN: missing rationale
    if (!q.rationale) {
      issues.push({ severity: 'WARN', questionId: id, externalId: extId, issue: 'Missing rationale' })
    }

    // WARN: null choices on non-math question (math grid-in may legitimately have null choices)
    const section = (q.skills as { section?: string } | null)?.section
    if (!q.choices && section !== 'math') {
      issues.push({ severity: 'WARN', questionId: id, externalId: extId, issue: 'null choices on non-math question' })
    }

    // WARN: official source but not validated
    if (q.source === 'official' && !q.validated) {
      issues.push({ severity: 'WARN', questionId: id, externalId: extId, issue: 'source=official but validated=false' })
    }
  }

  // Check duplicate external_ids
  for (const [extId, ids] of Array.from(externalIdMap.entries())) {
    if (ids.length > 1) {
      for (const id of ids) {
        issues.push({ severity: 'WARN', questionId: id, externalId: extId, issue: `Duplicate external_id: ${extId} (${ids.length} rows)` })
      }
    }
  }

  // Print results
  const severe = issues.filter((i) => i.severity === 'SEVERE')
  const warnings = issues.filter((i) => i.severity === 'WARN')

  if (issues.length === 0) {
    console.log('✓ No issues found.')
  } else {
    if (severe.length > 0) {
      console.log(`SEVERE (${severe.length}):`)
      for (const i of severe) {
        console.log(`  [SEVERE] ${i.questionId}${i.externalId ? ` (${i.externalId})` : ''}: ${i.issue}`)
      }
      console.log()
    }
    if (warnings.length > 0) {
      console.log(`WARNINGS (${warnings.length}):`)
      for (const i of warnings) {
        console.log(`  [WARN]   ${i.questionId}${i.externalId ? ` (${i.externalId})` : ''}: ${i.issue}`)
      }
      console.log()
    }
  }

  console.log(`Summary: ${questions.length} questions — ${severe.length} severe, ${warnings.length} warnings`)

  if (severe.length > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
