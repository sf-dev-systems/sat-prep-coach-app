/**
 * reveal-vault-secret.ts
 * Reads a decrypted secret from Supabase Vault by name and prints it to stdout.
 * Run locally only: npx tsx scripts/reveal-vault-secret.ts <secret_name>
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

const name = process.argv[2];
if (!name) {
  console.error('Usage: npx tsx scripts/reveal-vault-secret.ts <secret_name>');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .schema('vault')
    .from('decrypted_secrets')
    .select('name, decrypted_secret')
    .eq('name', name)
    .maybeSingle();

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  if (!data) {
    console.error(`No vault secret found with name "${name}".`);
    process.exit(1);
  }
  console.log(data.decrypted_secret);
}

main();
