import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// ▼▼▼ ここをご自身のFirebaseプロジェクトの設定に書き換えてください ▼▼▼
// Firebaseコンソール → 歯車アイコン「プロジェクトの設定」→ 全般 → 「マイアプリ」→
// ウェブアプリを追加 → 表示される firebaseConfig オブジェクトの値をそのままコピーして貼り付けます。
const firebaseConfig = {
  apiKey: "AIzaSyAdmMJMClSHjLhqLvG5k08PbXCsi6ezWb8",
  authDomain: "unip-kanri.firebaseapp.com",
  projectId: "unip-kanri",
  storageBucket: "unip-kanri.firebasestorage.app",
  messagingSenderId: "430477933750",
  appId: "1:430477933750:web:417d5f33867c00c1f9ba17",
};

// 編集を許可する管理者のメールアドレス（Firebase Authenticationで作成したご自身のアカウント）。
// ※本当のアクセス制限はFirestoreの「ルール」側で行います。ここは画面上の表示切り替え用です。
export const ADMIN_EMAIL = "uni.salon24@gmail.com";
// ▲▲▲ ここまで ▲▲▲

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// 全店舗・全スタッフのデータを1つのドキュメントにまとめて保存する
const DOC_PATH = ["uniSalon", "staffData"];

/**
 * データの変更をリアルタイムに購読する。
 * onData(rows) は rows=null（まだデータが無い）または配列で呼ばれる。
 * 戻り値は購読解除用の関数。
 */
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

/** 現在のスタッフデータ一式を保存する（ログインしていない場合はFirestoreのルールで拒否される） */
export async function saveStaffRows(rows) {
  const ref = doc(db, ...DOC_PATH);
  await setDoc(ref, { rows, updatedAt: Date.now() });
}

/** ログイン状態の変化を購読する。戻り値は購読解除用の関数。 */
export function subscribeAuthState(onChange) {
  return onAuthStateChanged(auth, onChange);
}

export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
}

