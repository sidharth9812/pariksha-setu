import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Export the active Firebase configuration
export { firebaseConfig };

// Initialize Primary App using canonical firebase-applet-config.json
export const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

// Initialize analytics safely if supported in browser environment
export let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {});
}

// Export Authentication
export const auth = getAuth(app);

// Export Cloud Firestore Database with the provisioned firestoreDatabaseId (CRITICAL for sync)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

