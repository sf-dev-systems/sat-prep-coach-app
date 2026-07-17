/**
 * Batch-update rationale fields for T4-RW questions from a JSON patch file.
 * Usage: npx tsx scripts/patch-rw-rationales.ts <patch-json-path>
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8')
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/)
      if (match) {
        const key = match[1].trim()
        let val = match[2].trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        process.env[key] = val
      }
    })
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PATCH_PATH = process.argv[2]

if (!PATCH_PATH) {
  console.error('Usage: npx tsx scripts/patch-rw-rationales.ts <patch-json-path>')
  process.exit(1)
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

type PatchEntry = { external_id: string; rationale: string }

async function main() {
  const patch: PatchEntry[] = JSON.parse(fs.readFileSync(PATCH_PATH, 'utf-8'))
  console.log(`Loaded ${patch.length} patch entries from ${PATCH_PATH}`)

  const BATCH = 10
  let updated = 0
  let errors = 0

  for (let i = 0; i < patch.length; i += BATCH) {
    const batch = patch.slice(i, i + BATCH)
    for (const entry of batch) {
      const { error } = await supabase
        .from('questions')
        .update({ rationale: entry.rationale })
        .eq('external_id', entry.external_id)

      if (error) {
        console.error(`  ERROR ${entry.external_id}: ${error.message}`)
        errors++
      } else {
        updated++
        process.stdout.write(`  OK ${entry.external_id}\n`)
      }
    }
    console.log(`  Batch ${Math.floor(i / BATCH) + 1} done (${Math.min(i + BATCH, patch.length)}/${patch.length})`)
  }

  console.log(`\nDone. Updated: ${updated}, Errors: ${errors}`)
}

main().catch(console.error)
