/**
 * Script to download BAAI/bge-small-en-v1.5 ONNX model files from Hugging Face
 * This ensures the model is bundled with the extension for offline use
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_ID = 'Xenova/bge-small-en-v1.5';
const BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/main`;
const OUTPUT_DIR = path.join(__dirname, '../public/models/bge-small-en-v1.5');

// Files needed for the ONNX model
const FILES_TO_DOWNLOAD = [
  'onnx/model_quantized.onnx',  // int8 quantized model (~34MB)
  'tokenizer.json',
  'tokenizer_config.json',
  'config.json',
  'special_tokens_map.json',
];

/**
 * Download a file from URL to destination
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307) {
        // Follow redirect
        file.close();
        fs.unlink(dest, () => {});
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`\r  Progress: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(2)} MB)`);
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(''); // New line after progress
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

/**
 * Main download function
 */
async function downloadModel() {
  console.log('📦 Downloading BAAI/bge-small-en-v1.5 model files...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Download each file
  for (const file of FILES_TO_DOWNLOAD) {
    const url = `${BASE_URL}/${file}`;
    const fileName = path.basename(file);
    const dest = path.join(OUTPUT_DIR, fileName);

    console.log(`⬇️  Downloading: ${fileName}`);

    try {
      await downloadFile(url, dest);
      console.log(`✅ Downloaded: ${fileName}\n`);
    } catch (error) {
      console.error(`❌ Failed to download ${fileName}:`, error.message);
      process.exit(1);
    }
  }

  // Calculate total size
  let totalSize = 0;
  fs.readdirSync(OUTPUT_DIR).forEach(file => {
    const stats = fs.statSync(path.join(OUTPUT_DIR, file));
    totalSize += stats.size;
  });

  console.log(`\n✨ Model downloaded successfully!`);
  console.log(`📊 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📁 Location: ${OUTPUT_DIR}`);
}

// Run the download
downloadModel().catch(err => {
  console.error('❌ Download failed:', err);
  process.exit(1);
});
