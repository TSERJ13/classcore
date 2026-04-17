import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ge.classcore',
  appName: 'ClassCore',
  webDir: 'out',
  server: {
    url: 'https://classcore.ge',
    cleartext: true
  }
};

export default config;
