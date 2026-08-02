import type { FirebaseApp } from 'firebase/app';
import type { Messaging } from 'firebase/messaging';

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

let firebaseAppPromise: Promise<FirebaseApp> | null = null;

async function getFirebaseApp(): Promise<FirebaseApp> {
  if (!firebaseAppPromise) {
    firebaseAppPromise = import('firebase/app').then(({ getApp, getApps, initializeApp }) =>
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApp(),
    );
  }
  return firebaseAppPromise;
}

/**
 * Returns the Firebase Messaging instance.
 * Must only be called on the client side (it uses browser APIs).
 * Returns null if running in a server context or if config is missing.
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('Firebase config missing – push notifications disabled');
    return null;
  }
  const [{ getMessaging }, firebaseApp] = await Promise.all([
    import('firebase/messaging'),
    getFirebaseApp(),
  ]);
  return getMessaging(firebaseApp);
}
