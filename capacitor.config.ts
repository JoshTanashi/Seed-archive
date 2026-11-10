import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.seedarchive',
  appName: 'The Seed Archive',
  webDir: 'dist',
  backgroundColor: '#0F0128',
  ios: { contentInset: 'never' },
};

export default config;
