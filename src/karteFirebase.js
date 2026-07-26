import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// ▼▼▼ カルテアプリ(uni-karte)と同じFirebaseプロジェクトの設定です ▼▼▼
const karteFirebaseConfig = {
  apiKey: "AIzaSyDV1IuGgciEx1yO5YTPx3ibLAeFYeDUhv4",
  authDomain: "uni-counseling.firebaseapp.com",
  projectId: "uni-counseling",
  storageBucket: "uni-counseling.firebasestorage.app",
  messagingSenderId: "547959659226",
  appId: "1:547959659226:web:2de8f6152d5a6da8a6a3e3",
};

// メインのダッシュボード用Firebaseアプリ("unip-kanri")とは別プロジェクトなので、
// 名前を付けて2つ目のFirebaseアプリとして初期化する
const karteApp = initializeApp(karteFirebaseConfig, "karteApp");
export const karteDb = getFirestore(karteApp);
export const karteAuth = getAuth(karteApp);

// 全店舗を横断して閲覧できる、ダッシュボード専用のログインアカウント
export const KARTE_OWNER_EMAIL = "uni.salon24@gmail.com";

const ALL_KARTE_STORES = ["児島店", "酒津店", "岡山店", "福山店", "会津若松店"];

export function subscribeKarteAuthState(onChange) {
  return onAuthStateChanged(karteAuth, onChange);
}

export async function loginToKarte(password) {
  await signInWithEmailAndPassword(karteAuth, KARTE_OWNER_EMAIL, password);
}

export async function logoutFromKarte() {
  await signOut(karteAuth);
}

/**
 * 来店記録(visits)を取得する。
 * Firestoreのwhere('in', ...)は最大10件までしか指定できないが、店舗は5つなので問題ない。
 *
 * sinceDate（例："2025-01-01"）を指定すると、その日以降の分だけを読み込む。
 * データが増えても読み込み量（＝Firestoreの読み取り回数・費用）が際限なく増えないようにするため、
 * 通常はこちらを使い、必要なときだけ全期間を読み込む（sinceDateを省略）ようにする。
 */
export async function fetchVisits(sinceDate) {
  const clauses = [where("store", "in", ALL_KARTE_STORES)];
  if (sinceDate) clauses.push(where("date", ">=", sinceDate));
  const q = query(collection(karteDb, "visits"), ...clauses);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 全期間分の来店記録を取得する（過去のインポート分も含む・費用が気になる場合は多用しない） */
export async function fetchAllVisits() {
  return fetchVisits(undefined);
}

/** 全店舗分の顧客情報(customers)を取得する（新規/リピート判定などに使う） */
export async function fetchAllCustomers() {
  const q = query(collection(karteDb, "customers"), where("store", "in", ALL_KARTE_STORES));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
