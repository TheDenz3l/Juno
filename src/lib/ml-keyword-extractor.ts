/**
 * ML-based keyword extractor using BGE embeddings
 * Provides semantic understanding of job descriptions
 */

export interface MLKeyword {
  keyword: string;
  score: number;
  importance: number; // Normalized 0-100
}

export interface MLExtractorOptions {
  topN?: number;
  timeout?: number; // ms
  minScore?: number;
}

/**
 * Wrapper class for ML keyword extraction using Web Worker
 */
export class MLKeywordExtractor {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private ready = false;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.initWorker();
  }

  /**
   * Initialize the Web Worker
   */
  private async initWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create worker from the bundled worker file
        this.worker = new Worker(
          new URL('../workers/embedding-worker.ts', import.meta.url),
          { type: 'module' }
        );

        // Handle messages from worker
        this.worker.addEventListener('message', (event) => {
          this.handleWorkerMessage(event.data);
        });

        // Handle worker errors
        this.worker.addEventListener('error', (error) => {
          console.error('[ML Extractor] Worker error:', error);
          reject(new Error(`Worker error: ${error.message}`));
        });

        // Wait for ready signal
        const readyHandler = (event: MessageEvent) => {
          if (event.data.type === 'ready') {
            this.ready = true;
            this.worker?.removeEventListener('message', readyHandler);
            resolve();
          }
        };

        this.worker.addEventListener('message', readyHandler);

        // Timeout if worker doesn't become ready
        setTimeout(() => {
          if (!this.ready) {
            reject(new Error('Worker initialization timeout'));
          }
        }, 30000); // 30 second timeout for model loading

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(message: any) {
    const { type, id, data, error } = message;

    if (type === 'loading_progress') {
      // Emit loading progress event
      console.log(`[ML Extractor] Loading: ${data.file} - ${Math.round(data.progress)}%`);
      return;
    }

    if (type === 'ready') {
      return; // Handled by initWorker
    }

    const request = this.pendingRequests.get(id);
    if (!request) {
      console.warn(`[ML Extractor] Received response for unknown request ID: ${id}`);
      return;
    }

    // Clear timeout
    clearTimeout(request.timeout);
    this.pendingRequests.delete(id);

    if (type === 'error') {
      request.reject(new Error(error.message));
    } else {
      request.resolve(data);
    }
  }

  /**
   * Send a message to the worker and await response
   */
  private async sendMessage(
    type: string,
    data: any,
    timeout: number = 60000
  ): Promise<any> {
    await this.readyPromise;

    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const id = this.messageId++;

      // Set timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, timeout);

      // Store request
      this.pendingRequests.set(id, { resolve, reject, timeout: timeoutHandle });

      // Send message
      this.worker!.postMessage({ type, data, id });
    });
  }

  /**
   * Extract keywords from job description using ML embeddings
   */
  async extractKeywords(
    jobDescription: string,
    options: MLExtractorOptions = {}
  ): Promise<MLKeyword[]> {
    const {
      topN = 20,
      timeout = 60000,
      minScore = 0.3
    } = options;

    try {
      const result = await this.sendMessage(
        'extract_keywords',
        { text: jobDescription, topN },
        timeout
      );

      // Convert scores to 0-100 importance scale
      const maxScore = result.length > 0 ? result[0].score : 1;
      const minScoreValue = result.length > 0 ? result[result.length - 1].score : 0;
      const scoreRange = maxScore - minScoreValue || 1;

      return result
        .filter((item: any) => item.score >= minScore)
        .map((item: any) => ({
          keyword: item.keyword,
          score: item.score,
          importance: Math.round(((item.score - minScoreValue) / scoreRange) * 100)
        }));

    } catch (error) {
      console.error('[ML Extractor] Failed to extract keywords:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string, timeout: number = 30000): Promise<number[]> {
    return this.sendMessage('generate_embedding', { text }, timeout);
  }

  /**
   * Calculate similarity between two embeddings
   */
  async calculateSimilarity(
    vectorA: number[],
    vectorB: number[],
    timeout: number = 5000
  ): Promise<number> {
    return this.sendMessage('calculate_similarity', { vectorA, vectorB }, timeout);
  }

  /**
   * Unload the model to free memory
   */
  async unload(): Promise<void> {
    if (this.worker) {
      await this.sendMessage('unload_model', {}, 5000);
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
  }

  /**
   * Check if the extractor is ready
   */
  isReady(): boolean {
    return this.ready;
  }
}

// Singleton instance for reuse across the extension
let extractorInstance: MLKeywordExtractor | null = null;

/**
 * Get or create the ML keyword extractor instance
 */
export function getMLExtractor(): MLKeywordExtractor {
  if (!extractorInstance) {
    extractorInstance = new MLKeywordExtractor();
  }
  return extractorInstance;
}

/**
 * Dispose of the ML keyword extractor instance
 */
export async function disposeMLExtractor(): Promise<void> {
  if (extractorInstance) {
    await extractorInstance.unload();
    extractorInstance = null;
  }
}
