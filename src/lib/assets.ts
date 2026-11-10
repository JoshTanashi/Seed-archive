// Every image in the kit, addressed by its path under src/assets without the
// extension, e.g. img('icons/biome-jungle') or img('wizard/portrait/smile').
const files = import.meta.glob(['../assets/**/*.png', '!../assets/app-icon/**'], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  byName[path.replace('../assets/', '').replace('.png', '')] = url;
}

export function img(name: string): string {
  const url = byName[name];
  if (!url) throw new Error(`Missing kit asset: ${name}`);
  return url;
}

export const PORTRAIT_POSES = [
  'neutral', 'neutral-talk', 'smile', 'smile-talk', 'suspicious', 'dopey', 'startled',
  'sheepish', 'sad', 'whisper', 'smug', 'sleepy', 'neutral-talk-hand', 'smile-talk-hand',
] as const;
export type Pose = (typeof PORTRAIT_POSES)[number];
export type FullBody = 'startled-jump' | 'lonely-stump' | 'casting' | 'celebrate';

/** Resolves a path under /public (audio) against the app's base URL. */
export function publicUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '');
}
