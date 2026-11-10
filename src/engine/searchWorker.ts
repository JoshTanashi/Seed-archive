/// <reference lib="webworker" />
import { SeedEngine, seedToString } from './engine';
import type { Edition, SearchParams, SeedDetail, SeedMatch, StageStats } from './types';

/*
 * The search worker. It works through random seeds in the edition's seed
 * range, and the engine checks each one cheapest-test-first. Matches stream
 * back as they are found. The loop yields every few dozen milliseconds so a
 * cancel message is noticed promptly, and it never touches the UI thread.
 */

export type WorkerRequest =
  | { type: 'search'; job: number; params: SearchParams }
  | { type: 'cancel'; job: number }
  | { type: 'detail'; req: number; seed: string; edition: Edition; version: number; structIds: number[]; strongholds: boolean; radius: number }
  | { type: 'map'; req: number; seed: string; edition: Edition; version: number; cx: number; cz: number; size: number; scale: 4 | 16 | 64 };

export type WorkerReply =
  | { type: 'match'; job: number; match: SeedMatch }
  | { type: 'progress'; job: number; searched: number; stats: StageStats }
  | { type: 'detail'; req: number; detail: SeedDetail }
  | { type: 'map'; req: number; pixels: Uint8ClampedArray<ArrayBuffer>; size: number }
  | { type: 'error'; job?: number; req?: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const enginePromise = SeedEngine.load();
let activeJob = -1;

const post = (reply: WorkerReply, transfer: Transferable[] = []) => ctx.postMessage(reply, transfer);

// A zero-delay yield (setTimeout is clamped to 4ms once nested).
const channel = new MessageChannel();
let resumeLoop: (() => void) | null = null;
channel.port1.onmessage = () => resumeLoop?.();
const yieldToMessages = () =>
  new Promise<void>((resolve) => {
    resumeLoop = resolve;
    channel.port2.postMessage(0);
  });

/**
 * Seed range.
 * Java accepts any signed 64-bit number, so we draw from all of them.
 * Bedrock: every version accepts 0 .. 2,147,483,647 typed as a plain number
 * and treats it the same way (structure placement only ever reads the low 32
 * bits; older versions stored nothing more). Staying inside that range means
 * every seed we return can be typed into any Bedrock version.
 */
const rnd = new Uint32Array(2);
function nextSeed(edition: Edition): [lo: number, hi: number] {
  crypto.getRandomValues(rnd);
  return edition === 'java' ? [rnd[0], rnd[1]] : [rnd[0] >>> 1, 0];
}

async function runSearch(job: number, params: SearchParams): Promise<void> {
  const engine = await enginePromise;
  if (!engine.use(params.edition, params.version)) {
    post({ type: 'error', job, message: 'Unsupported version' });
    return;
  }
  engine.setFilters(params.filters);
  activeJob = job;
  let searched = 0;
  while (activeJob === job) {
    const sliceEnd = performance.now() + 40;
    do {
      const [lo, hi] = nextSeed(params.edition);
      engine.setSeedParts(lo, hi);
      searched++;
      const seed = seedToString((BigInt(hi) << 32n) | BigInt(lo));
      const match = engine.check(seed);
      if (match) post({ type: 'match', job, match });
    } while (performance.now() < sliceEnd);
    post({ type: 'progress', job, searched, stats: engine.stats() });
    await yieldToMessages();
  }
}

ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'search') {
      await runSearch(msg.job, msg.params);
    } else if (msg.type === 'cancel') {
      if (activeJob === msg.job) activeJob = -1;
    } else if (msg.type === 'detail') {
      const engine = await enginePromise;
      const detail = engine.describe(msg.seed, msg.edition, msg.version, msg.structIds, msg.strongholds, msg.radius);
      post({ type: 'detail', req: msg.req, detail });
    } else if (msg.type === 'map') {
      const engine = await enginePromise;
      engine.use(msg.edition, msg.version);
      const pixels = engine.renderBiomeMap(msg.seed, msg.cx, msg.cz, msg.size, msg.scale);
      post({ type: 'map', req: msg.req, pixels, size: msg.size }, [pixels.buffer]);
    }
  } catch (err) {
    post({
      type: 'error',
      job: 'job' in msg ? msg.job : undefined,
      req: 'req' in msg ? msg.req : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
