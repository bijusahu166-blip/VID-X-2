import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iqpartner.app',
  appName: 'IQ PARTNER',
  webDir: 'dist/public',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#000000",
      showSpinner: false
    }
  }
};

export default config;