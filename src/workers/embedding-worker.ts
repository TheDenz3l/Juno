/**
 * Web Worker for BGE embedding model inference
 * Runs ML operations in a background thread to keep UI responsive
 */

import { pipeline, env } from '@huggingface/transformers';

// Configure Transformers.js environment for Chrome extension
env.allowLocalModels = true;
env.localModelPath = chrome.runtime.getURL('models/');
env.allowRemoteModels = false; // Only use bundled models
if (env.backends.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('wasm/');
}

/**
 * Singleton pattern for model loading
 * Ensures the model is only loaded once and reused across inference calls
 */
class EmbeddingModelSingleton {
  private static instance: any = null;
  private static loading: Promise<any> | null = null;
  private static modelId = 'bge-small-en-v1.5';

  static async getInstance(): Promise<any> {
    // If already loaded, return it
    if (this.instance) {
      return this.instance;
    }

    // If currently loading, wait for it
    if (this.loading) {
      return this.loading;
    }

    // Start loading
    this.loading = (async () => {
      try {
        console.log('[Embedding Worker] Loading BGE model...');

        this.instance = await pipeline(
          'feature-extraction',
          this.modelId,
          {
            // int8 quantized model is already set as default
            progress_callback: (progress: any) => {
              if (progress.status === 'progress') {
                self.postMessage({
                  type: 'loading_progress',
                  data: {
                    file: progress.file,
                    progress: progress.progress || 0,
                    loaded: progress.loaded || 0,
                    total: progress.total || 0
                  }
                });
              }
            }
          }
        );

        console.log('[Embedding Worker] Model loaded successfully!');
        this.loading = null;
        return this.instance;
      } catch (error) {
        console.error('[Embedding Worker] Failed to load model:', error);
        this.loading = null;
        throw error;
      }
    })();

    return this.loading;
  }

  static async unload() {
    if (this.instance) {
      // @ts-ignore - dispose method may exist
      if (typeof this.instance.dispose === 'function') {
        // @ts-ignore
        await this.instance.dispose();
      }
      this.instance = null;
    }
  }
}

/**
 * Generate embedding for a single text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const model = await EmbeddingModelSingleton.getInstance();

  const result = await model(text, {
    pooling: 'mean',
    normalize: true
  });

  // Extract the embedding vector
  return Array.from(result.data as Float32Array);
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extract keywords from job description using semantic similarity
 */
async function extractKeywords(
  jobDescription: string,
  topN: number = 20
): Promise<Array<{ keyword: string; score: number }>> {
  try {
    // Split text into sentences
    const sentences = jobDescription
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter very short sentences

    if (sentences.length === 0) {
      return [];
    }

    // Generate embedding for the entire job description
    console.log('[Embedding Worker] Generating job description embedding...');
    const jobEmbedding = await generateEmbedding(jobDescription);

    // Extract potential keywords (nouns, adjectives, technical terms)
    const keywordCandidates = new Set<string>();
    const wordPattern = /\b[A-Z][a-z]*(?:[A-Z][a-z]*)*\b|\b[a-z]{3,}\b/g;

    for (const sentence of sentences) {
      const words = sentence.match(wordPattern) || [];
      words.forEach(word => {
        if (word.length >= 3 && !isStopWord(word.toLowerCase())) {
          keywordCandidates.add(word);
        }
      });
    }

    console.log(`[Embedding Worker] Found ${keywordCandidates.size} keyword candidates`);

    // Calculate semantic similarity for each candidate
    const keywordScores: Array<{ keyword: string; score: number }> = [];

    for (const keyword of Array.from(keywordCandidates).slice(0, 100)) { // Limit to avoid too many API calls
      try {
        const keywordEmbedding = await generateEmbedding(keyword);
        const similarity = cosineSimilarity(jobEmbedding, keywordEmbedding);

        keywordScores.push({
          keyword,
          score: similarity
        });
      } catch (error) {
        console.warn(`[Embedding Worker] Failed to process keyword: ${keyword}`, error);
      }
    }

    // Sort by score and return top N
    keywordScores.sort((a, b) => b.score - a.score);

    return keywordScores.slice(0, topN);
  } catch (error) {
    console.error('[Embedding Worker] Error extracting keywords:', error);
    throw error;
  }
}

/**
 * Basic stop word filter
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what'
  ]);

  return stopWords.has(word);
}

/**
 * Message handler for worker
 */
self.addEventListener('message', async (event: MessageEvent) => {
  const { type, data, id } = event.data;

  try {
    switch (type) {
      case 'extract_keywords': {
        const keywords = await extractKeywords(data.text, data.topN || 20);
        self.postMessage({
          type: 'keywords_result',
          id,
          data: keywords
        });
        break;
      }

      case 'generate_embedding': {
        const embedding = await generateEmbedding(data.text);
        self.postMessage({
          type: 'embedding_result',
          id,
          data: embedding
        });
        break;
      }

      case 'calculate_similarity': {
        const similarity = cosineSimilarity(data.vectorA, data.vectorB);
        self.postMessage({
          type: 'similarity_result',
          id,
          data: similarity
        });
        break;
      }

      case 'unload_model': {
        await EmbeddingModelSingleton.unload();
        self.postMessage({
          type: 'unload_complete',
          id
        });
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
  }
});

// Signal that worker is ready
self.postMessage({ type: 'ready' });

console.log('[Embedding Worker] Initialized and ready');
