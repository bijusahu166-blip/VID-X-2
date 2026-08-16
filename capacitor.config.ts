import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iqpartner.app',
  appName: 'IQ PARTNER',
  webDir: 'dist',
  server: {
    url: process.env.EXPO_PUBLIC_API_URL || 'https://iqpartner.xyz',
    cleartext: true,
    androidScheme: 'http'
  }
};

export default config;