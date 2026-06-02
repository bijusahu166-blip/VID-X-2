import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vidx.app',
  appName: 'VID-X',
  webDir: 'dist',
  server: {
    url: process.env.EXPO_PUBLIC_API_URL || 'https://vid-x-2.onrender.com',
    cleartext: true,
    androidScheme: 'http'
  }
};

export default config;