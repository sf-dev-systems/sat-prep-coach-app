/**
 * verify-seed.ts
 * Query the live `skills` table to verify sections, domains, leaf skills, and hierarchy.
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('Querying the live `skills` table...');
  const { data: skills, error } = await supabase.from('skills').select('*');

  if (error || !skills) {
    console.error('Error fetching skills:', error);
    process.exit(1);
  }

  console.log(`Fetched ${skills.length} total rows from the database.\n`);

  // 1. Separate nodes by level
  const sections = skills.filter(s => s.parent_skill_id === null);
  const sectionIds = new Set(sections.map(s => s.id));

  const domains = skills.filter(s => s.parent_skill_id !== null && sectionIds.has(s.parent_skill_id));
  const domainIds = new Set(domains.map(s => s.id));

  const leafSkills = skills.filter(s => s.parent_skill_id !== null && domainIds.has(s.parent_skill_id));

  // 2. Perform validation assertions
  console.log('--- STRUCTURAL VERIFICATION ---');
  console.log(`- Section Rows Found: ${sections.length} (Expected: 3)`);
  console.log(`- Domain Rows Found: ${domains.length} (Expected: 11)`);
  console.log(`- Leaf Skill Rows Found: ${leafSkills.length} (Expected: 29)`);

  const sectionsOk = sections.length === 3;
  const domainsOk = domains.length === 11;
  const leavesOk = leafSkills.length === 29;

  if (sectionsOk && domainsOk && leavesOk) {
    console.log('✓ Counts match expectations perfectly!');
  } else {
    console.error('✗ WARNING: Count mismatch!');
  }

  // 3. Print nested taxonomy representation
  console.log('\n--- TAXONOMY HIERARCHY TREE AND WEIGHTS ---');

  for (const sec of sections) {
    console.log(`[Section] ${sec.name} (${sec.section.toUpperCase()})`);
    
    const secDomains = domains.filter(d => d.parent_skill_id === sec.id);
    for (const dom of secDomains) {
      console.log(`  ├── [Domain] ${dom.name}`);
      
      const domSkills = leafSkills.filter(sk => sk.parent_skill_id === dom.id);
      for (const sk of domSkills) {
        console.log(`  │    ├── [Skill] ${sk.name} (Weight: ${sk.weight})`);
      }
    }
    console.log('');
  }

  // 4. Verify linking and mappings
  let linkingOk = true;
  for (const sk of leafSkills) {
    const parentDom = domains.find(d => d.id === sk.parent_skill_id);
    if (!parentDom) {
      console.error(`✗ Skill "${sk.name}" has invalid parent domain id ${sk.parent_skill_id}`);
      linkingOk = false;
    } else {
      const parentSec = sections.find(s => s.id === parentDom.parent_skill_id);
      if (!parentSec) {
        console.error(`✗ Domain "${parentDom.name}" has invalid parent section id ${parentDom.parent_skill_id}`);
        linkingOk = false;
      }
    }
  }

  if (linkingOk) {
    console.log('✓ HIERARCHY LINKING IS PERFECTLY INTACT!');
  } else {
    console.error('✗ HIERARCHY LINKING IS DAMAGED!');
  }
}

verify().catch(console.error);
