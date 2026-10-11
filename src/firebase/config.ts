import { initializeApp, getApps, getApp } from 'firebase/app';
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

// Analytics is intentionally not imported or initialized to avoid '@firebase/analytics: Failed to fetch'
// errors in sandboxed iframes or environments without Google Analytics endpoints
export const analytics = null;

// Export Authentication
export const auth = getAuth(app);

// Export Cloud Firestore Database with the provisioned firestoreDatabaseId (CRITICAL for sync)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// Validate connection to Firestore as per Firebase skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration.');
    }
  }
}
if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}
