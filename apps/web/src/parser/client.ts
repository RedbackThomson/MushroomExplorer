import { wrap, type Remote } from 'comlink';
import type { GameDataSource } from './types';

let cached: { worker: Worker; proxy: Remote<GameDataSource> } | null = null;

/**
 * Lazily create the parser worker and return a comlink-wrapped proxy. Reuses
 * the same worker for the lifetime of the page so caches inside the parser
 * are preserved.
 */
export function getParserClient(): Remote<GameDataSource> {
  if (!cached) {
    const worker = new Worker(new URL('@/workers/parseWorker.ts', import.meta.url), {
      type: 'module',
      name: 'mge-parser',
    });
    cached = { worker, proxy: wrap<GameDataSource>(worker) };
  }
  return cached.proxy;
}

export function terminateParserClient(): void {
  if (cached) {
    cached.worker.terminate();
    cached = null;
  }
}
