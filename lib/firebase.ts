import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCGSz0hFW6TsKAH49rqGqfAUAX-W-AxtMw",
  authDomain: "mytripplanner-54005.firebaseapp.com",
  projectId: "mytripplanner-54005",
  storageBucket: "mytripplanner-54005.firebasestorage.app",
  messagingSenderId: "126839700711",
  appId: "1:126839700711:web:5bf6e81fcaa8c90ebc7642",
  measurementId: "G-8CXBF6CYZJ"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
