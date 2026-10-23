import { initializeApp } from "firebase/app"
import { connectAuthEmulator, getAuth } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore"

// Test mode (`npm run dev:test`): talk ONLY to the local Firebase emulators.
// The "demo-" project ID is a Firebase convention for projects that don't
// exist — the SDK can never reach real café data with it, even by mistake.
export const isTestEnv = import.meta.env.VITE_USE_EMULATORS === 'true'
export const TEST_PROJECT_ID = 'demo-bubblekaapeh'

const firebaseConfig = {
  apiKey: "AIzaSyAByZDmjI-WINp0DueXfPAeSi8s8TziD6g",
  authDomain: "bubblekaapeh.firebaseapp.com",
  projectId: "bubblekaapeh",
  storageBucket: "bubblekaapeh.firebasestorage.app",
  messagingSenderId: "674952935820",
  appId: "1:674952935820:web:eb4bca2c352e945c267ea9",
  measurementId: "G-5HM0M05831"
};

const app = initializeApp(
  isTestEnv
    ? { ...firebaseConfig, projectId: TEST_PROJECT_ID, authDomain: `${TEST_PROJECT_ID}.firebaseapp.com` }
    : firebaseConfig
)
export const auth = getAuth(app)
export const db = getFirestore(app)

if (isTestEnv) {
  const host = import.meta.env.VITE_EMULATOR_HOST || '127.0.0.1'
  connectFirestoreEmulator(db, host, Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080))
  connectAuthEmulator(auth, `http://${host}:${import.meta.env.VITE_AUTH_EMULATOR_PORT || 9099}`, { disableWarnings: true })
}
