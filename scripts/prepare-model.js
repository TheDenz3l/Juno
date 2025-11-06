/**
 * Uses Transformers.js to download and cache the model,
 * then copies it to our public/models directory for bundling
 */

import { pipeline, env } from '@huggingface/transformers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_ID = 'Xenova/bge-small-en-v1.5';
const OUTPUT_DIR = path.join(__dirname, '../public/models/bge-small-en-v1.5');

console.log('📦 Preparing BGE embedding model for bundling...\n');
console.log(`Model: ${MODEL_ID}`);
console.log(`Output: ${OUTPUT_DIR}\n`);

// Set cache directory
env.cacheDir = path.join(__dirname, '../.cache/transformers');
env.allowLocalModels = false; // Force download from HuggingFace

async function prepareModel() {
  try {
    console.log('⬇️  Loading model (will download if not cached)...');

    // This will download the model to the cache
    const extractor = await pipeline('feature-extraction', MODEL_ID, {
      quantized: true,  // Use int8 quantized version
      progress_callback: (progress) => {
        if (progress.status === 'downloading') {
          console.log(`  Downloading: ${progress.file} - ${Math.round(progress.progress || 0)}%`);
        } else if (progress.status === 'done') {
          console.log(`  ✓ ${progress.file}`);
        }
      }
    });

    console.log('\n✅ Model loaded successfully!');

    // Find the cached model files
    const cacheDir = path.join(__dirname, '../.cache/transformers/Xenova/bge-small-en-v1.5');

    if (!fs.existsSync(cacheDir)) {
      throw new Error(`Cache directory not found: ${cacheDir}`);
    }

    console.log('\n📁 Copying model files to public/models...');

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Copy all files from cache to output
    const files = fs.readdirSync(cacheDir);
    for (const file of files) {
      const src = path.join(cacheDir, file);
      const dest = path.join(OUTPUT_DIR, file);

      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest);
        const size = fs.statSync(dest).size;
        console.log(`  ✓ ${file} (${(size / 1024 / 1024).toFixed(2)} MB)`);
      }
    }

    // Calculate total size
    let totalSize = 0;
    fs.readdirSync(OUTPUT_DIR).forEach(file => {
      const stats = fs.statSync(path.join(OUTPUT_DIR, file));
      totalSize += stats.size;
    });

    console.log(`\n✨ Model prepared successfully!`);
    console.log(`📊 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📁 Location: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('\n❌ Error preparing model:', error.message);
    process.exit(1);
  }
}

prepareModel();
