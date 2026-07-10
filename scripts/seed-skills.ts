/**
 * seed-skills.ts
 * Populate the `skills` table in Supabase with the Section -> Domain -> Skill hierarchy.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse environment variables manually from .env.local to ensure 0 external dependency issues
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

// Define the exact tree structure to loop through
const taxonomy = [
  {
    section: 'math',
    name: 'Math',
    domains: [
      {
        name: 'Algebra',
        skills: [
          { name: 'Linear Equations & Inequalities', weight: 10 },
          { name: 'Systems of Equations', weight: 10 }
        ]
      },
      {
        name: 'Advanced Math',
        skills: [
          { name: 'Quadratics & Parabolas', weight: 12 },
          { name: 'Polynomials & Non-linear Functions', weight: 12 }
        ]
      },
      {
        name: 'Problem-Solving & Data Analysis',
        skills: [
          { name: 'Ratios, Rates & Proportions', weight: 8 },
          { name: 'Percentages', weight: 8 },
          { name: 'Statistics & Probability', weight: 10 }
        ]
      },
      {
        name: 'Geometry & Trigonometry',
        skills: [
          { name: 'Area & Volume', weight: 7 },
          { name: 'Triangles & Circles', weight: 8 },
          { name: 'Trigonometry', weight: 5 }
        ]
      }
    ]
  },
  {
    section: 'rw',
    name: 'Reading/Writing',
    domains: [
      {
        name: 'Information & Ideas',
        skills: [
          { name: 'Central Ideas & Details', weight: 12 },
          { name: 'Command of Evidence', weight: 15 },
          { name: 'Inferences', weight: 10 }
        ]
      },
      {
        name: 'Craft & Structure',
        skills: [
          { name: 'Words in Context', weight: 12 },
          { name: 'Text Structure & Purpose', weight: 10 },
          { name: 'Cross-Text Connections', weight: 8 }
        ]
      },
      {
        name: 'Expression of Ideas',
        skills: [
          { name: 'Transitions', weight: 8 },
          { name: 'Rhetorical Synthesis', weight: 7 }
        ]
      },
      {
        name: 'Standard English Conventions',
        skills: [
          { name: 'Boundaries (Punctuation)', weight: 10 },
          { name: 'Form, Structure, & Sense', weight: 8 }
        ]
      }
    ]
  },
  {
    section: 'strategy',
    name: 'Strategy',
    domains: [
      {
        name: 'Time & Attention Management',
        skills: [
          { name: 'Module Pacing', weight: 0.10 },
          { name: 'Skip-and-Return Discipline', weight: 0.08 },
          { name: 'End-of-Module Triage', weight: 0.05 }
        ]
      },
      {
        name: 'Interface & Tool Fluency',
        skills: [
          { name: 'Desmos Proficiency', weight: 0.12 },
          { name: 'Digital Annotation', weight: 0.05 },
          { name: 'Elimination Interface', weight: 0.05 }
        ]
      },
      {
        name: 'Distractor Pattern Recognition',
        skills: [
          { name: 'Extreme Language Traps', weight: 0.08 },
          { name: 'Half-Right / Half-Wrong Traps', weight: 0.10 },
          { name: 'Scope & Relevance Traps', weight: 0.07 }
        ]
      }
    ]
  }
];

// Helper function to safely insert or update nodes without duplicating
async function ensureNode(nodeData: { section: string; domain: string | null; name: string; parent_skill_id: string | null; weight: number | null }) {
  // Check if it exists
  const { data: existing } = await supabase
    .from('skills')
    .select('id')
    .eq('section', nodeData.section)
    .eq('name', nodeData.name)
    .maybeSingle();

  if (existing) {
    // Update weight and relationships in case they changed
    const { data: updated, error } = await supabase
      .from('skills')
      .update(nodeData)
      .eq('id', existing.id)
      .select('id')
      .single();
    
    if (error) throw error;
    return updated.id;
  } else {
    // Insert new
    const { data: inserted, error } = await supabase
      .from('skills')
      .insert(nodeData)
      .select('id')
      .single();
    
    if (error) throw error;
    return inserted.id;
  }
}

async function seed() {
  console.log('Seeding SAT taxonomy tree against true schema...');

  for (const sec of taxonomy) {
    // 1. Seed Section Node
    const sectionId = await ensureNode({
      section: sec.section,
      domain: null,
      name: sec.name,
      parent_skill_id: null,
      weight: null
    });
    console.log(`✓ Section: ${sec.name}`);

    for (const dom of sec.domains) {
      // 2. Seed Domain Node
      const domainId = await ensureNode({
        section: sec.section,
        domain: dom.name,
        name: dom.name,
        parent_skill_id: sectionId,
        weight: null
      });
      console.log(`  ✓ Domain: ${dom.name}`);

      for (const skill of dom.skills) {
        // 3. Seed Skill Node
        await ensureNode({
          section: sec.section,
          domain: dom.name, // Keep domain attached to leaf nodes
          name: skill.name,
          parent_skill_id: domainId,
          weight: skill.weight
        });
      }
      console.log(`    ✓ Seeded ${dom.skills.length} skills`);
    }
  }

  console.log('Taxonomy tree successfully seeded and linked!');
}

seed().catch(console.error);
