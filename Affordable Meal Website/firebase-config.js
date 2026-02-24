// firebase-config.js – COMPLETE & CORRECT VERSION (Jan 2026)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCR6xpE_Cgin5etLNVLu8SlGi7aYdgOV48",
  authDomain: "affordablemeal-d4210.firebaseapp.com",
  projectId: "affordablemeal-d4210",
  storageBucket: "affordablemeal-d4210.firebasestorage.app",
  messagingSenderId: "829936068333",
  appId: "1:829936068333:web:b4cfff058afc39cd27cee4",
  measurementId: "G-6PFB80E2CM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export EVERYTHING your script.js is asking for
export {
  auth,
  db,
  storage,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  ref,
  uploadBytes,
  getDownloadURL
};