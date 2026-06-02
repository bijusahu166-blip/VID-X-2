import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBLsKDnK-sAXOoVMXW0jKKP4r7Lvko0kNM",
  authDomain: "circledot-de42b.firebaseapp.com",
  projectId: "circledot-de42b",
  storageBucket: "circledot-de42b.firebasestorage.app",
  messagingSenderId: "95852535310",
  appId: "1:95852535310:android:af5154f774773c38b2265f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);