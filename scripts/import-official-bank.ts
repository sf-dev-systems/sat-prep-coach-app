/**
 * import-official-bank.ts
 * CLI script to import official SAT questions from a JSON file into Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse environment variables manually from .env.local
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface InputQuestionFormat {
  skill_name: string; // The name of the skill, which we map to ID
  difficulty: number; // 1, 2, or 3
  stem: string;
  choices: string[] | null; // null for grid-ins
  correct_answer: string;
  rationale?: string;
  distractor_notes?: Record<string, string>;
  trap_type?: string;
  license?: string;
  media_urls?: string[] | null;
  external_id?: string;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Error: Please provide path to questions JSON file.');
    console.log('Usage: npm run import-bank <path-to-json>');
    process.exit(1);
  }

  const jsonPath = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: File not found at ${jsonPath}`);
    process.exit(1);
  }

  console.log(`Reading questions from ${jsonPath}...`);
  const fileContent = fs.readFileSync(jsonPath, 'utf-8');
  let inputQuestions: InputQuestionFormat[];
  try {
    inputQuestions = JSON.parse(fileContent);
  } catch (err: any) {
    console.error('Error: Failed to parse JSON file:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(inputQuestions)) {
    console.error('Error: JSON file must contain an array of questions.');
    process.exit(1);
  }

  console.log(`Loaded ${inputQuestions.length} questions from file.`);

  // Fetch skills to build a lookup map of name -> ID
  console.log('Fetching skills from Supabase for mapping...');
  const { data: skills, error: skillsError } = await supabase
    .from('skills')
    .select('id, name');

  if (skillsError || !skills) {
    console.error('Error fetching skills list:', skillsError);
    process.exit(1);
  }

  const skillNameMap: Record<string, string> = {};
  skills.forEach(s => {
    skillNameMap[s.name.toLowerCase().trim()] = s.id;
  });

  console.log(`Mapped ${skills.length} skills for association.`);

  const mappedQuestions: any[] = [];
  let skippedCount = 0;

  for (const q of inputQuestions) {
    const normSkillName = q.skill_name.toLowerCase().trim();
    const skillId = skillNameMap[normSkillName];

    if (!skillId) {
      console.warn(`Warning: Skill name "${q.skill_name}" not found in database. Skipped this question.`);
      skippedCount++;
      continue;
    }

    mappedQuestions.push({
      skill_id: skillId,
      source: 'official',
      difficulty: q.difficulty,
      stem: q.stem,
      choices: q.choices,
      correct_answer: q.correct_answer,
      rationale: q.rationale || null,
      distractor_notes: q.distractor_notes || null,
      trap_type: q.trap_type || null,
      license: q.license || null,
      external_id: q.external_id || null,
      media_urls: q.media_urls || null,
      validated: true, // Official questions are validated by default
    });
  }

  if (mappedQuestions.length === 0) {
    console.log('No valid questions to import. Exiting.');
    process.exit(0);
  }

  console.log(`Upserting ${mappedQuestions.length} questions into questions table...`);
  const { error: insertError } = await supabase
    .from('questions')
    .upsert(mappedQuestions, { onConflict: 'external_id', ignoreDuplicates: false });

  if (insertError) {
    console.error('Error importing questions:', insertError);
    process.exit(1);
  }

  console.log(`Successfully imported ${mappedQuestions.length} official questions (skipped ${skippedCount} unknown skills).`);
}

main().catch(err => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
