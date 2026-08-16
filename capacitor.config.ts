import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iqpartner.app',
  appName: 'IQ PARTNER',
  webDir: 'dist/public',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 500,
      backgroundColor: "#ffff",
      showSpinner: false
    }
  }
};

export default config;