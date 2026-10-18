import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for ParikshaSetu
 *
 * Package ID: 'com.parikshasetu.app'
 * (Default approved placeholder. If you prefer a custom reversed domain
 * such as 'in.parikshasetu.exam' or 'org.parikshasetu.student', you can easily adjust this here and in android/app/build.gradle)
 */
const config: CapacitorConfig = {
  appId: 'com.parikshasetu.app',
  appName: 'ParikshaSetu',
  webDir: 'dist',
  server: {
    // Ensures internal navigation and Firebase Auth / Cloudinary fetch operate strictly over HTTPS scheme
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1e293b',
    },
    App: {},
  },
};

export default config;
