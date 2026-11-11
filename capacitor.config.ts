import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // NOTE: appId is the iOS bundle identifier. Change to your own reverse-DNS
  // domain before creating the App Store listing — it cannot be changed later.
  appId: 'com.twigen.app',
  appName: 'TWI Gen',
  webDir: 'dist',
  backgroundColor: '#0c0e17',
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#0c0e17',
      launchAutoHide: true,
      showSpinner: false,
    },
  },
};

export default config;
