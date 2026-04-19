import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyBCcY1qnsuIv86HY7f80SwYJ-S4bCU02Hc",
  authDomain: "digital-menu-demo.firebaseapp.com",
  projectId: "digital-menu-demo",
  storageBucket: "digital-menu-demo.firebasestorage.app",
  messagingSenderId: "732021785618",
  appId: "1:732021785618:web:c823d24afa87366a8584cb"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
