import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vidx.app',
  appName: 'VID-X',
  webDir: 'dist',
  server: {
    url: 'http://192.168.1.40:5001', 
    cleartext: true,
    androidScheme: 'http'
  }
};

export default config;