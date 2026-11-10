import type { Edition, SearchParams, SeedDetail, SeedMatch, StageStats } from './types';
import type { WorkerReply, WorkerRequest } from './searchWorker';

export const MAX_MATCHES = 25;
export const TIME_LIMIT_MS = 60_000;

export type DoneReason = 'limit' | 'timeout' | 'cancelled' | 'error';

export interface SearchHandlers {
  onMatch(match: SeedMatch): void;
  onProgress(searched: number, stats: StageStats, elapsedMs: number): void;
  onDone(reason: DoneReason): void;
}

/**
 * Where seeds come from. Today that is the phone itself (deviceSource below).
 * Phase 2 swaps in a server-backed implementation of this same interface, and
 * nothing else in the app needs to change.
 */
export interface SeedSource {
  /** Starts a search. Returns a function that cancels it. */
  search(params: SearchParams, handlers: SearchHandlers): () => void;
  detail(seed: string, edition: Edition, version: number, structIds: number[], strongholds: boolean, radius: number): Promise<SeedDetail>;
  map(seed: string, edition: Edition, version: number, cx: number, cz: number, size: number, scale: 4 | 16 | 64): Promise<ImageData>;
}

class DeviceSource implements SeedSource {
  private workers: Worker[] = [];
  private nextId = 1;
  private pending = new Map<number, (reply: WorkerReply) => void>();
  private jobListeners = new Map<number, (reply: WorkerReply, worker: number) => void>();

  private pool(): Worker[] {
    if (this.workers.length === 0) {
      const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
      const count = Math.max(1, Math.min(4, cores - 1));
      for (let i = 0; i < count; i++) {
        const w = new Worker(new URL('./searchWorker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (ev: MessageEvent<WorkerReply>) => this.route(ev.data, i);
        this.workers.push(w);
      }
    }
    return this.workers;
  }

  private route(reply: WorkerReply, worker: number): void {
    if ('req' in reply && reply.req !== undefined) {
      const done = this.pending.get(reply.req);
      this.pending.delete(reply.req);
      done?.(reply);
    } else if ('job' in reply && reply.job !== undefined) {
      this.jobListeners.get(reply.job)?.(reply, worker);
    }
  }

  private send(worker: Worker, msg: WorkerRequest): void {
    worker.postMessage(msg);
  }

  search(params: SearchParams, handlers: SearchHandlers): () => void {
    const workers = this.pool();
    const job = this.nextId++;
    const started = performance.now();
    const seen = new Set<string>();
    const searched = new Array<number>(workers.length).fill(0);
    const stats: StageStats[] = workers.map(() => ({ reached: [0, 0, 0, 0], passed: [0, 0, 0, 0] }));
    let finished = false;

    const finish = (reason: DoneReason) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      this.jobListeners.delete(job);
      for (const w of workers) this.send(w, { type: 'cancel', job });
      handlers.onDone(reason);
    };
    const timer = window.setTimeout(() => finish('timeout'), TIME_LIMIT_MS);

    this.jobListeners.set(job, (reply, index) => {
      if (finished) return;
      if (reply.type === 'match') {
        if (seen.has(reply.match.seed)) return;
        seen.add(reply.match.seed);
        handlers.onMatch(reply.match);
        if (seen.size >= MAX_MATCHES) finish('limit');
      } else if (reply.type === 'progress') {
        searched[index] = reply.searched;
        stats[index] = reply.stats;
        const total: StageStats = { reached: [0, 0, 0, 0], passed: [0, 0, 0, 0] };
        for (const s of stats) {
          for (let i = 0; i < 4; i++) {
            total.reached[i] += s.reached[i];
            total.passed[i] += s.passed[i];
          }
        }
        handlers.onProgress(searched.reduce((a, b) => a + b, 0), total, performance.now() - started);
      } else if (reply.type === 'error') {
        finish('error');
      }
    });
    for (const w of workers) this.send(w, { type: 'search', job, params });
    return () => finish('cancelled');
  }

  private request<T extends WorkerReply['type']>(msg: WorkerRequest & { req: number }, type: T) {
    return new Promise<Extract<WorkerReply, { type: T }>>((resolve, reject) => {
      this.pending.set(msg.req, (reply) => {
        if (reply.type === type) resolve(reply as Extract<WorkerReply, { type: T }>);
        else reject(new Error(reply.type === 'error' ? reply.message : 'Unexpected reply'));
      });
      // The last worker is the least likely to be mid-slice during a search.
      const workers = this.pool();
      this.send(workers[workers.length - 1], msg);
    });
  }

  async detail(seed: string, edition: Edition, version: number, structIds: number[], strongholds: boolean, radius: number): Promise<SeedDetail> {
    const reply = await this.request({ type: 'detail', req: this.nextId++, seed, edition, version, structIds, strongholds, radius }, 'detail');
    return reply.detail;
  }

  async map(seed: string, edition: Edition, version: number, cx: number, cz: number, size: number, scale: 4 | 16 | 64): Promise<ImageData> {
    const reply = await this.request({ type: 'map', req: this.nextId++, seed, edition, version, cx, cz, size, scale }, 'map');
    return new ImageData(reply.pixels, reply.size, reply.size);
  }
}

export const deviceSource: SeedSource = new DeviceSource();

/** The source the app uses. Swap this for the server source in phase 2. */
export const seedSource: SeedSource = deviceSource;
