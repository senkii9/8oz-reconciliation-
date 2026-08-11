import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCJZ-GJKSSA1kkvRJK_n4sKK2v25k1kM34",
  authDomain: "helical-turbine-1hnbb.firebaseapp.com",
  projectId: "helical-turbine-1hnbb",
  storageBucket: "helical-turbine-1hnbb.firebasestorage.app",
  messagingSenderId: "77507839757",
  appId: "1:77507839757:web:84e4c704b708fb2efed244",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
