import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tentelcom.portal',
  appName: 'Tentelcom Portal',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
