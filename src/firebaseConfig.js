import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAdmMJMClSHjLhqLvG5k08PbXCsi6ezWb8",
  authDomain: "unip-kanri.firebaseapp.com",
  projectId: "unip-kanri",
  storageBucket: "unip-kanri.firebasestorage.app",
  messagingSenderId: "430477933750",
  appId: "1:430477933750:web:417d5f33867c00c1f9ba17",
};

export const ADMIN_EMAIL = "uni.salon24@gmail.com";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const DOC_PATH = ["uniSalon", "staffData"];

export function subscribeStaffRows(onData, onError) {
  const ref = doc(db, ...DOC_PATH);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onData(Array.isArray(data.rows) ? data.rows : []);
      } else {
        onData(null);
      }
    },
    (err) => {
      console.error("Firestore read error:", err);
      onError && onError(err);
    }
  );
}

export async function saveStaffRows(rows) {
  const ref = doc(db, ...DOC_PATH);
  await setDoc(ref, { rows, updatedAt: Date.now() });
}

export function subscribeAuthState(onChange) {
  return onAuthStateChanged(auth, onChange);
}

export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
}
