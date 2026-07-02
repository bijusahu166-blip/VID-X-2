import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vidx.app',
  appName: 'VAMPIRE',
  webDir: 'dist',
  server: {
    url: process.env.EXPO_PUBLIC_API_URL || 'https://vid-x-2.onrender.com',
    cleartext: true,
    androidScheme: 'http'
  }
};

export default config;