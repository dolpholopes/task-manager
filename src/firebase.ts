import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDYr9AXcd0zf3_dSU_aLwQc96iduTAJU9o",
  authDomain: "mytasks-32b80.firebaseapp.com",
  projectId: "mytasks-32b80",
  storageBucket: "mytasks-32b80.firebasestorage.app",
  messagingSenderId: "973830791046",
  appId: "1:973830791046:web:4e88caeb4ce3c65ffe9607"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
