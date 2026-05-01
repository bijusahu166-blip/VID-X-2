import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vidx.app',
  appName: 'VID-X',
  webDir: 'dist',
  server: {
    url: 'https://vid-x-2-production.up.railway.app', 
    cleartext: true,
    androidScheme: 'http'
  }
};

export default config;