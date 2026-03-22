/**
 * Generate embeddings for all jobs that don't have one yet.
 * Uses Xenova/all-MiniLM-L6-v2 (384-dim) running locally via WASM.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... node scripts/generate-embeddings.mjs
 *
 * First-time setup:
 *   npm install @xenova/transformers
 *   (model auto-downloads on first run, ~80MB)
 *
 * Performance: ~1300 jobs in 5-10 minutes on a modern laptop.
 */

import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('Loading embedding model (first run downloads ~80MB)...');
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
console.log('Model loaded.');

function buildEmbeddingText(job) {
  const parts = [
    job.title,
    job.department,
    job.tags ? job.tags.join(' ') : '',
    job.qualification,
    // Truncate description to avoid exceeding model's 256-token window
    job.description ? job.description.slice(0, 500) : '',
  ];
  return parts.filter(Boolean).join(' ');
}

async function run() {
  const BATCH_SIZE = 50;
  let totalProcessed = 0;
  let totalErrors = 0;

  console.log('Starting embedding generation for jobs without embeddings...\n');

  while (true) {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, title, department, description, qualification, tags')
      .is('embedding', null)
      .limit(BATCH_SIZE);

    if (error) {
      console.error('Fetch error:', error.message);
      break;
    }

    if (!jobs || jobs.length === 0) {
      console.log('No more jobs without embeddings.');
      break;
    }

    for (const job of jobs) {
      try {
        const text = buildEmbeddingText(job);
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);

        const { error: updateError } = await supabase
          .from('jobs')
          .update({ embedding })
          .eq('id', job.id);

        if (updateError) {
          console.error(`  ✗ ${job.title}: ${updateError.message}`);
          totalErrors++;
        } else {
          totalProcessed++;
        }
      } catch (err) {
        console.error(`  ✗ ${job.title}: ${err.message}`);
        totalErrors++;
      }
    }

    console.log(`Processed batch: ${totalProcessed} done, ${totalErrors} errors`);
  }

  console.log(`\nDone! ${totalProcessed} embeddings generated, ${totalErrors} errors.`);
}

run().catch(console.error);
