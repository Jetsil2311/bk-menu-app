import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage, connectStorageEmulator } from "firebase/storage"


const firebaseConfig = {
  apiKey: "AIzaSyAByZDmjI-WINp0DueXfPAeSi8s8TziD6g",
  authDomain: "bubblekaapeh.firebaseapp.com",
  projectId: "bubblekaapeh",
  storageBucket: "bubblekaapeh.firebasestorage.app",
  messagingSenderId: "674952935820",
  appId: "1:674952935820:web:eb4bca2c352e945c267ea9",
  measurementId: "G-5HM0M05831"
};

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

if (typeof window !== "undefined" && window.location?.hostname === "localhost") {
  connectStorageEmulator(storage, "127.0.0.1", 9199)
}
