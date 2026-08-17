import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iqpartner.app',
  appName: 'IQ PARTNER',
  webDir: 'dist/public',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 300,
      backgroundColor: "#",
      showSpinner: false
    }
  }
};

export default config;