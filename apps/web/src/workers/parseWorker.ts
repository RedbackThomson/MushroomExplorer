/// <reference lib="WebWorker" />
// IMPORTANT: this side-effect import must come first. It aliases `window` to
// the Worker global so `@tybys/wz` modules don't throw at load time. See
// workerEnv.ts for details.
import './workerEnv';
import { expose } from 'comlink';
import { WzDataSource } from '@/parser/WzDataSource';
import { ensureWzInit } from '@/parser/wzInit';
import { createLogger, describeError } from '@/lib/logger';
import type { GameDataSource, LoadFileSpec, WzMapleVersionName } from '@/parser/types';

const log = createLogger('worker');
log.info('worker started');

class WorkerGameDataSource implements GameDataSource {
  private readonly inner = new WzDataSource();

  async init(version: WzMapleVersionName) {
    log.info('init requested', { version });
    try {
      await ensureWzInit();
    } catch (e) {
      log.error('ensureWzInit failed', describeError(e));
      throw e;
    }
    await this.inner.init(version);
  }
  load(files: LoadFileSpec[]) {
    return this.inner.load(files);
  }
  getNode(path: string) {
    return this.inner.getNode(path);
  }
  listChildren(path: string) {
    return this.inner.listChildren(path);
  }
  listFiles() {
    return this.inner.listFiles();
  }
  diagnose() {
    return this.inner.diagnose();
  }
  dispose() {
    return this.inner.dispose();
  }
}

expose(new WorkerGameDataSource());
