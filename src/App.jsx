import React, { useMemo, useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { subscribeStaffRows, saveStaffRows, subscribeAuthState, login, logout, ADMIN_EMAIL } from "./firebaseConfig";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import {
  Crown,
  CalendarCheck2,
  UserPlus,
  JapaneseYen,
  Store as StoreIcon,
  Upload,
  Plus,
  Trash2,
  Download,
  LayoutDashboard,
  Table2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Printer,
  Wallet,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Mock data — swap this block for a real CSV export from Salon Board, or wire
// up a spreadsheet import, when connecting real data.
// ---------------------------------------------------------------------------
const SEED_MONTH = "2026年6月";

// 直営 / FC の区分（店舗タブのバッジ表示に使用）
const STORE_TYPE = {
  児島店: "直営",
  酒津店: "直営",
  会津若松店: "直営",
  岡山店: "FC",
  福山店: "FC",
};

// 実際の報告データは店舗名列が不正確な場合がある（例：酒津店/児島店がまとめて「倉敷店」と
// 入力されている等）ため、スタッフ名が分かっている場合は名前を優先して店舗を判定する。
// 報告シート上で別名で提出されることがあるスタッフの名寄せ
const NAME_ALIASES = {
  金谷智子: "新井智子",
};

// 店舗タブの表示順（直営 → FC）
const STORE_ORDER = ["児島店", "酒津店", "会津若松店", "岡山店", "福山店"];

const STAFF_STORE_MAP = {
  大藤佳奈子: "酒津店",
  佐々木梨紗: "酒津店",
  滝澤麻美: "酒津店",
  新井智子: "児島店",
  小野木慶子: "会津若松店",
  中村晴美: "福山店",
  難波順一朗: "岡山店", // 岡山店オーナー
};

// 共有いただいた月次報告シートの実データ（2026年1月〜6月分）をそのまま反映。
// 「金谷智子」名義の報告は新井智子さん本人（児島店）と判明したため統合済み。倉敷店という店舗は存在しない。
const REPORTED_ROWS = [
  // 大藤佳奈子（酒津店）
  { name: "大藤佳奈子", month: "2026年1月", newC: 5, newBookings: 4, repeatC: 55, repeatBookings: 51, sales: 993_000 },
  { name: "大藤佳奈子", month: "2026年2月", newC: 3, newBookings: 3, repeatC: 66, repeatBookings: 58, sales: 1_078_600 },
  { name: "大藤佳奈子", month: "2026年3月", newC: 3, newBookings: 3, repeatC: 67, repeatBookings: 60, sales: 1_166_900 },
  { name: "大藤佳奈子", month: "2026年4月", newC: 9, newBookings: 5, repeatC: 62, repeatBookings: 55, sales: 1_185_000 },
  { name: "大藤佳奈子", month: "2026年5月", newC: 1, newBookings: 1, repeatC: 73, repeatBookings: 64, sales: 1_309_500 },
  { name: "大藤佳奈子", month: "2026年6月", newC: 7, newBookings: 3, repeatC: 69, repeatBookings: 57, sales: 1_291_700 },
  // 佐々木梨紗（酒津店）
  { name: "佐々木梨紗", month: "2026年2月", newC: 9, newBookings: 6, repeatC: 43, repeatBookings: 41, sales: 776_400 },
  { name: "佐々木梨紗", month: "2026年3月", newC: 6, newBookings: 6, repeatC: 52, repeatBookings: 47, sales: 920_100 },
  { name: "佐々木梨紗", month: "2026年4月", newC: 15, newBookings: 12, repeatC: 39, repeatBookings: 37, sales: 878_500 },
  { name: "佐々木梨紗", month: "2026年5月", newC: 8, newBookings: 4, repeatC: 50, repeatBookings: 45, sales: 1_006_600 },
  { name: "佐々木梨紗", month: "2026年6月", newC: 6, newBookings: 4, repeatC: 52, repeatBookings: 47, sales: 1_030_100 },
  // 滝澤麻美（酒津店）
  { name: "滝澤麻美", month: "2026年2月", newC: 5, newBookings: 4, repeatC: 55, repeatBookings: 50, sales: 1_014_500 },
  { name: "滝澤麻美", month: "2026年3月", newC: 4, newBookings: 3, repeatC: 61, repeatBookings: 59, sales: 1_104_900 },
  { name: "滝澤麻美", month: "2026年4月", newC: 8, newBookings: 6, repeatC: 59, repeatBookings: 56, sales: 1_125_000 },
  { name: "滝澤麻美", month: "2026年5月", newC: 4, newBookings: 2, repeatC: 58, repeatBookings: 56, sales: 1_092_400 },
  { name: "滝澤麻美", month: "2026年6月", newC: 8, newBookings: 6, repeatC: 57, repeatBookings: 57, sales: 1_095_300 },
  // 難波順一朗（岡山店）
  { name: "難波順一朗", month: "2026年2月", newC: 9, newBookings: 9, repeatC: 10, repeatBookings: 7, sales: 341_700 }, // ご注意: 元データのF列が88.89と非整数だったため9に補正
  { name: "難波順一朗", month: "2026年3月", newC: 12, newBookings: 11, repeatC: 21, repeatBookings: 20, sales: 543_500 },
  { name: "難波順一朗", month: "2026年4月", newC: 7, newBookings: 6, repeatC: 28, repeatBookings: 26, sales: 595_700 },
  { name: "難波順一朗", month: "2026年5月", newC: 13, newBookings: 12, repeatC: 32, repeatBookings: 32, sales: 738_100 },
  { name: "難波順一朗", month: "2026年6月", newC: 10, newBookings: 10, repeatC: 34, repeatBookings: 33, sales: 667_100 },
  // 難波幸平（児島店）：ご本人が売上等を直接入力予定
  { name: "難波幸平", store: "児島店", month: "2026年6月", newC: 0, newBookings: 0, repeatC: 0, repeatBookings: 0, sales: 0, productSales: 0 },
  // 中村晴美（福山店）
  { name: "中村晴美", month: "2026年2月", newC: 5, newBookings: 2, repeatC: 72, repeatBookings: 34, sales: 1_219_550 },
  { name: "中村晴美", month: "2026年3月", newC: 11, newBookings: 8, repeatC: 79, repeatBookings: 34, sales: 1_299_150 },
  { name: "中村晴美", month: "2026年4月", newC: 8, newBookings: 5, repeatC: 99, repeatBookings: 46, sales: 1_381_660 },
  { name: "中村晴美", month: "2026年5月", newC: 11, newBookings: 7, repeatC: 74, repeatBookings: 44, sales: 1_442_200 },
  { name: "中村晴美", month: "2026年6月", newC: 21, newBookings: 8, repeatC: 76, repeatBookings: 34, sales: 1_442_950 },
  // 小野木慶子（会津若松店・出店初月）
  { name: "小野木慶子", month: "2026年6月", newC: 26, newBookings: 22, repeatC: 1, repeatBookings: 1, sales: 445_100 },
  // 新井智子（児島店）※これまで「金谷智子」名義で報告されていた分。倉敷店という店舗は存在しないため児島店として統合。
  { name: "新井智子", month: "2026年5月", newC: 12, newBookings: 10, repeatC: 47, repeatBookings: 46, sales: 1_070_700 },
  { name: "新井智子", month: "2026年6月", newC: 9, newBookings: 5, repeatC: 52, repeatBookings: 51, sales: 1_127_000 },
];

function buildInitialStaff() {
  return REPORTED_ROWS.map((r, i) => ({
    id: `seed-${i}`,
    store: r.store || STAFF_STORE_MAP[r.name] || "本店",
    ...r,
  }));
}

const INITIAL_STAFF = buildInitialStaff();

const safeDiv = (a, b) => (b > 0 ? a / b : 0);
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function aggregateBy(rows, key, valueKey = "sales") {
  const map = new Map();
  rows.forEach((r) => {
    map.set(r[key], (map.get(r[key]) || 0) + Number(r[valueKey] || 0));
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, [valueKey]: value }));
}

// 店舗ごとの売上（技術売上＋店販売上の合計）を集計する
function aggregateSalesByStore(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const total = Number(r.sales || 0) + Number(r.productSales || 0);
    map.set(r.store, (map.get(r.store) || 0) + total);
  });
  return Array.from(map.entries()).map(([name, sales]) => ({ name, 売上: sales }));
}

// 複数行（月・スタッフ）から各種指標を集計する共通ロジック
function computeAggregate(rows) {
  const totalNew = rows.reduce((a, r) => a + Number(r.newC || 0), 0);
  const totalNewBookings = rows.reduce((a, r) => a + Number(r.newBookings || 0), 0);
  const totalRepeat = rows.reduce((a, r) => a + Number(r.repeatC || 0), 0);
  const totalRepeatBookings = rows.reduce((a, r) => a + Number(r.repeatBookings || 0), 0);
  const totalTechnicalSales = rows.reduce((a, r) => a + Number(r.sales || 0), 0);
  const totalProductSales = rows.reduce((a, r) => a + Number(r.productSales || 0), 0);
  const totalSales = totalTechnicalSales + totalProductSales;
  const totalCustomers = totalNew + totalRepeat;
  return {
    totalNew,
    totalNewBookings,
    totalRepeat,
    totalRepeatBookings,
    totalTechnicalSales,
    totalProductSales,
    totalSales,
    totalCustomers,
    newBookingRate: safeDiv(totalNewBookings, totalNew),
    repeatBookingRate: safeDiv(totalRepeatBookings, totalRepeat),
    customerRepeatRate: safeDiv(totalRepeat, totalCustomers),
    avgSpend: safeDiv(totalSales, totalCustomers),
  };
}

// 明らかにおかしい入力値を検知する（次回予約数が母数より多い、マイナス値、非整数の人数など）
function rowAnomalies(r) {
  const issues = [];
  const newC = Number(r.newC),
    newB = Number(r.newBookings),
    repC = Number(r.repeatC),
    repB = Number(r.repeatBookings),
    sales = Number(r.sales);
  if (newB > newC) issues.push("新規次回予約が新規客数より多い");
  if (repB > repC) issues.push("リピート次回予約が既存客数より多い");
  if ([newC, newB, repC, repB, sales].some((v) => v < 0)) issues.push("マイナスの値が含まれている");
  if ([newC, newB, repC, repB].some((v) => Number.isFinite(v) && !Number.isInteger(v))) issues.push("人数が整数になっていない");
  return issues;
}

// "2026年6月" -> 24312 (year*12+month) for chronological sorting; falls back to 0
function monthSortKey(label) {
  const m = String(label || "").match(/(\d+)\D*年\D*(\d+)\D*月/);
  if (!m) return 0;
  return Number(m[1]) * 12 + Number(m[2]);
}

// "6/9" -> { num: 6, den: 9 }; returns null if not a fraction-shaped value
function parseFraction(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { num: Number(m[1]), den: Number(m[2]) };
}

const numOnly = (raw) => Number(String(raw ?? "").replace(/[^0-9.-]/g, "")) || 0;

// Uni. のロゴマーク（アップロードされた画像を軽量化してBase64で埋め込み）
const LOGO_ICON =
  "data:image/jpeg;base64,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";

// "2026/01/31" や "2026-06-30" のような日付表記を "2026年1月" に正規化する。
// すでに "2026年6月" 形式ならそのまま返す。
function parseMonthLabel(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/(\d{4})[\/\-](\d{1,2})(?:[\/\-]\d{1,2})?/);
  if (m) return `${m[1]}年${Number(m[2])}月`;
  return s;
}

// 月次報告シートは「新規」の直後・「既存」の直後に、どちらも同じ見出し「リピート」の列が来る
// (ヘッダー名が重複する)ため、名前だけでなく位置関係も使って列を特定する。
function resolveColumns(headerRow) {
  const H = headerRow.map((h) => String(h ?? "").trim());
  const idx = (names) => {
    for (const n of names) {
      const i = H.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  const nameIdx = idx(["お名前", "スタッフ名", "name"]);
  const storeIdx = idx(["店舗名", "店舗", "store"]);
  const monthIdx = idx(["報告月", "月", "month"]);
  const salesIdx = idx(["技術売上", "売上", "sales"]);
  const productSalesIdx = idx(["店販売上", "店販", "productSales"]);

  const newFractionIdx = idx(["新規入客数"]);
  const newCIdx = idx(["新規", "newC"]);
  let newBookingsIdx = idx(["新規次回予約", "newBookings"]);
  if (newBookingsIdx === -1 && newCIdx !== -1 && H[newCIdx + 1] === "リピート") {
    newBookingsIdx = newCIdx + 1;
  }

  const repeatFractionIdx = idx(["既存入客数"]);
  const repeatCIdx = idx(["既存", "repeatC"]);
  let repeatBookingsIdx = idx(["リピート次回予約", "repeatBookings"]);
  if (repeatBookingsIdx === -1 && repeatCIdx !== -1 && H[repeatCIdx + 1] === "リピート") {
    repeatBookingsIdx = repeatCIdx + 1;
  }
  // 「既存」列自体が見つからず、単独の「リピート」列しかない手入力テンプレートのケース
  const plainRepeatCIdx = repeatCIdx !== -1 ? repeatCIdx : idx(["リピート"]);

  return {
    nameIdx,
    storeIdx,
    monthIdx,
    salesIdx,
    productSalesIdx,
    newFractionIdx,
    newCIdx,
    newBookingsIdx,
    repeatFractionIdx,
    repeatCIdx: repeatCIdx !== -1 ? repeatCIdx : plainRepeatCIdx,
    repeatBookingsIdx,
  };
}

const yen = (n) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const pct = (n) => `${(n * 100).toFixed(1)}%`;

const GOLD = "#B8892E";
const GOLD_LIGHT = "#E6C878";
const INK = "#241F19";
const INK_SOFT = "#5B5347";
const TEAL = "#2F5D57";
const PAPER = "#FBF7EF";
const PAPER_2 = "#F1E8D8";
const LINE = "#E3D6BC";
const PLUM = "#6E4A56";

// 王冠は「次回予約率（新規）80%以上」かつ「次回予約率（顧客）90%以上」を両方達成した場合のみ表示
const NEW_BOOKING_THRESHOLD = 0.8;
const REPEAT_BOOKING_THRESHOLD = 0.9;

// 全員共有の保存状態を小さく表示する
// 管理者ログイン用の小さなフォーム
function LoginBox({ user, isAdmin }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: INK_SOFT }}>
        {isAdmin ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: GOLD, fontWeight: 700 }}>
            <Crown size={12} /> 編集者としてログイン中
          </span>
        ) : (
          <span>閲覧のみ（{user.email}）</span>
        )}
        <button
          className="sd-btn"
          onClick={() => logout()}
          style={{ background: "transparent", border: `1px solid ${LINE}`, color: INK_SOFT, borderRadius: 4, padding: "4px 10px", fontSize: 12 }}
        >
          ログアウト
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        className="sd-btn no-print"
        onClick={() => setOpen(true)}
        style={{ background: "transparent", border: `1px solid ${LINE}`, color: INK_SOFT, borderRadius: 4, padding: "6px 12px", fontSize: 12 }}
      >
        編集者ログイン
      </button>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      setOpen(false);
    } catch (err) {
      setError("ログインできませんでした。メールアドレスとパスワードをご確認ください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="no-print"
      style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 6 }}
    >
      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ border: `1px solid ${LINE}`, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 150, fontFamily: "'Noto Sans JP', sans-serif" }}
      />
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ border: `1px solid ${LINE}`, borderRadius: 4, padding: "6px 8px", fontSize: 12, width: 120, fontFamily: "'Noto Sans JP', sans-serif" }}
      />
      <button
        type="submit"
        disabled={busy}
        style={{ background: INK, color: PAPER, border: "none", borderRadius: 4, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
      >
        {busy ? "..." : "ログイン"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        style={{ background: "transparent", border: "none", color: INK_SOFT, fontSize: 12, cursor: "pointer" }}
      >
        閉じる
      </button>
      {error && <span style={{ fontSize: 11, color: PLUM, position: "absolute", marginTop: 34 }}>{error}</span>}
    </form>
  );
}

function SaveStatus({ loadState, saveState }) {
  if (loadState === "loading") {
    return (
      <span className="no-print" style={{ fontSize: 11.5, color: INK_SOFT, display: "inline-flex", alignItems: "center", gap: 4 }}>
        読み込み中…
      </span>
    );
  }
  if (saveState === "saving") {
    return (
      <span className="no-print" style={{ fontSize: 11.5, color: INK_SOFT, display: "inline-flex", alignItems: "center", gap: 4 }}>
        保存中…
      </span>
    );
  }
  if (saveState === "error") {
    return (
      <span className="no-print" style={{ fontSize: 11.5, color: PLUM, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <AlertTriangle size={12} /> 保存できませんでした
      </span>
    );
  }
  if (saveState === "saved") {
    return (
      <span className="no-print" style={{ fontSize: 11.5, color: INK_SOFT, display: "inline-flex", alignItems: "center", gap: 4 }}>
        全員共有データ・保存済み
      </span>
    );
  }
  return null;
}

function RatingBadge({ newBookingRate, repeatBookingRate }) {
  const achieved = newBookingRate >= NEW_BOOKING_THRESHOLD && repeatBookingRate >= REPEAT_BOOKING_THRESHOLD;
  if (achieved) {
    return <Crown size={18} style={{ color: GOLD, filter: `drop-shadow(0 0 4px ${GOLD_LIGHT})` }} fill={GOLD} />;
  }
  return <span style={{ fontSize: 12, color: INK_SOFT }}>—</span>;
}

// 前月比の増減を矢印付きで表示する
function Delta({ diff, unit }) {
  if (diff === null || diff === undefined || Number.isNaN(diff)) return null;
  const roundedForPercent = Math.round(diff * 10) / 10;
  const flat = unit === "pt" ? Math.abs(roundedForPercent) < 0.1 : Math.abs(diff) < 1;
  if (flat) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, color: INK_SOFT }}>
        <Minus size={11} /> 前月と同水準
      </span>
    );
  }
  const up = diff > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const sign = up ? "+" : "-";
  const text = unit === "pt" ? `${sign}${Math.abs(roundedForPercent).toFixed(1)}pt` : `${sign}¥${Math.round(Math.abs(diff)).toLocaleString("ja-JP")}`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, color: up ? TEAL : PLUM, fontWeight: 700 }}>
      <Icon size={12} /> {text} 前月比
    </span>
  );
}

function KpiCard({ icon, label, value, sub, delta, accent }) {
  return (
    <div
      style={{
        background: PAPER_2,
        border: `1px solid ${LINE}`,
        borderRadius: 4,
        padding: "20px 22px",
        flex: "1 1 220px",
        minWidth: 220,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: INK_SOFT, marginBottom: 10 }}>
        {icon}
        <span style={{ fontSize: 12.5, letterSpacing: 1, fontFamily: "'Noto Sans JP', sans-serif" }}>{label}</span>
      </div>
      <div style={{ fontFamily: "'Shippori Mincho', serif", fontSize: 34, color: INK, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6 }}>{sub}</div>}
      {delta && <div style={{ marginTop: 6 }}>{delta}</div>}
    </div>
  );
}

function TextCell({ value, onChange, width, readOnly }) {
  if (readOnly) {
    return <span style={{ display: "inline-block", width: width || "100%", fontSize: 13, padding: "4px 2px", color: INK }}>{value}</span>;
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: width || "100%",
        border: "none",
        borderBottom: "1px solid transparent",
        background: "transparent",
        fontSize: 13,
        fontFamily: "'Noto Sans JP', sans-serif",
        color: INK,
        padding: "4px 2px",
      }}
      onFocus={(e) => (e.target.style.borderBottom = `1px solid ${GOLD}`)}
      onBlur={(e) => (e.target.style.borderBottom = "1px solid transparent")}
    />
  );
}

function NumberCell({ value, onChange, width, readOnly }) {
  if (readOnly) {
    return (
      <span style={{ display: "inline-block", width: width || 78, fontSize: 13, padding: "4px 2px", textAlign: "right", color: INK, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    );
  }
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: width || 78,
        border: "none",
        borderBottom: "1px solid transparent",
        background: "transparent",
        fontSize: 13,
        fontFamily: "'Noto Sans JP', sans-serif",
        color: INK,
        padding: "4px 2px",
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}
      onFocus={(e) => (e.target.style.borderBottom = `1px solid ${GOLD}`)}
      onBlur={(e) => (e.target.style.borderBottom = "1px solid transparent")}
    />
  );
}

export default function App() {
  const [view, setView] = useState("dashboard"); // "dashboard" | "data"
  const [selected, setSelected] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [staffRows, setStaffRows] = useState(INITIAL_STAFF);
  const [importMsg, setImportMsg] = useState("");
  const [importStore, setImportStore] = useState("");

  const [loadState, setLoadState] = useState("loading"); // loading | loaded | error
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [user, setUser] = useState(null);
  const fileInputRef = useRef(null);
  const saveTimerRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const isRemoteUpdateRef = useRef(false);

  const isAdmin = !!(user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  // ログイン状態を購読（管理者本人かどうかで編集可否を切り替える）
  useEffect(() => {
    const unsubscribe = subscribeAuthState((u) => setUser(u));
    return () => unsubscribe && unsubscribe();
  }, []);

  // 初回読み込み＆リアルタイム同期：全員で共有されたデータをFirestoreから取得。
  // 他のスタッフ・店長が編集すると、ここにも自動で反映される（onSnapshotによるリアルタイム更新）。
  useEffect(() => {
    const unsubscribe = subscribeStaffRows(
      (rows) => {
        if (rows === null) {
          // Firestoreにまだドキュメントが無い＝初回起動。初期データを保存しておく。
          saveStaffRows(INITIAL_STAFF).catch(() => {});
          setStaffRows(INITIAL_STAFF);
        } else if (Array.isArray(rows)) {
          isRemoteUpdateRef.current = true;
          setStaffRows(rows);
        }
        hasLoadedRef.current = true;
        setLoadState("loaded");
      },
      () => setLoadState("error")
    );
    return () => unsubscribe && unsubscribe();
  }, []);

  // 変更があるたびに（少し待ってから）全員共有のFirestoreへ自動保存（管理者のみ）
  useEffect(() => {
    if (!hasLoadedRef.current) return; // 読み込み完了前の初期状態では保存しない
    if (!isAdmin) return; // 閲覧のみのユーザーは保存を試みない（Firestoreのルールでも拒否される）
    if (isRemoteUpdateRef.current) {
      // 他の人の変更を受信して更新しただけの場合は、書き戻す必要が無いのでスキップ
      isRemoteUpdateRef.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveStaffRows(staffRows);
        setSaveState("saved");
      } catch (err) {
        setSaveState("error");
      }
    }, 700);
    return () => clearTimeout(saveTimerRef.current);
  }, [staffRows]);

  const storeNames = useMemo(() => {
    const seen = [];
    staffRows.forEach((r) => {
      if (r.store && !seen.includes(r.store)) seen.push(r.store);
    });
    return seen.sort((a, b) => {
      const ia = STORE_ORDER.indexOf(a);
      const ib = STORE_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [staffRows]);

  const availableMonths = useMemo(() => {
    const seen = new Set();
    staffRows.forEach((r) => r.month && seen.add(r.month));
    return Array.from(seen).sort((a, b) => monthSortKey(b) - monthSortKey(a)); // newest first
  }, [staffRows]);

  const effectiveMonth = availableMonths.includes(selectedMonth) ? selectedMonth : availableMonths[0] || "";

  const storeFilteredStaff = useMemo(
    () => (selected === "all" ? staffRows : staffRows.filter((r) => r.store === selected)),
    [staffRows, selected]
  );
  const filteredStaff = useMemo(
    () => storeFilteredStaff.filter((r) => r.month === effectiveMonth),
    [storeFilteredStaff, effectiveMonth]
  );

  const kpi = useMemo(() => computeAggregate(filteredStaff), [filteredStaff]);

  const availableMonthsAsc = useMemo(() => [...availableMonths].sort((a, b) => monthSortKey(a) - monthSortKey(b)), [availableMonths]);

  const prevMonth = useMemo(() => {
    const idx = availableMonthsAsc.indexOf(effectiveMonth);
    return idx > 0 ? availableMonthsAsc[idx - 1] : null;
  }, [availableMonthsAsc, effectiveMonth]);

  const prevKpi = useMemo(() => {
    if (!prevMonth) return null;
    return computeAggregate(storeFilteredStaff.filter((r) => r.month === prevMonth));
  }, [storeFilteredStaff, prevMonth]);

  const monthlyTrend = useMemo(() => {
    const byMonth = new Map();
    storeFilteredStaff.forEach((r) => {
      if (!r.month) return;
      if (!byMonth.has(r.month)) byMonth.set(r.month, []);
      byMonth.get(r.month).push(r);
    });
    return Array.from(byMonth.entries())
      .map(([month, rows]) => ({ month, ...computeAggregate(rows) }))
      .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));
  }, [storeFilteredStaff]);

  const storeCompareData = useMemo(
    () => aggregateSalesByStore(staffRows.filter((r) => r.month === effectiveMonth)),
    [staffRows, effectiveMonth]
  );

  const rankedStaff = useMemo(() => {
    return [...filteredStaff]
      .map((r) => {
        const totalSales = Number(r.sales || 0) + Number(r.productSales || 0);
        return {
          ...r,
          customerRepeatRate: safeDiv(Number(r.repeatC || 0), Number(r.newC || 0) + Number(r.repeatC || 0)),
          newBookingRate: safeDiv(Number(r.newBookings || 0), Number(r.newC || 0)),
          repeatBookingRate: safeDiv(Number(r.repeatBookings || 0), Number(r.repeatC || 0)),
          totalSales,
          avgSpend: safeDiv(totalSales, Number(r.newC || 0) + Number(r.repeatC || 0)),
          anomalies: rowAnomalies(r),
        };
      })
      .sort((a, b) => b.repeatBookingRate - a.repeatBookingRate);
  }, [filteredStaff]);

  // ---- data editing helpers ----
  const updateStaff = (id, field, value) => {
    setStaffRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };
  const removeStaff = (id) => setStaffRows((prev) => prev.filter((r) => r.id !== id));
  const addStaffRow = () => {
    setStaffRows((prev) => [
      ...prev,
      {
        id: uid("staff"),
        store: selected !== "all" ? selected : storeNames[0] || "新しい店舗",
        name: "新しいスタッフ",
        month: effectiveMonth || SEED_MONTH,
        newC: 0,
        newBookings: 0,
        repeatC: 0,
        repeatBookings: 0,
        sales: 0,
        productSales: 0,
      },
    ]);
  };

  const downloadTemplate = () => {
    const header = "店舗,スタッフ名,新規,新規次回予約,リピート,リピート次回予約,技術売上,店販売上\n";
    const example = "渋谷店,山田太郎,10,4,20,18,500000,30000\n";
    const blob = new Blob(["\uFEFF" + header + example], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        // header:1 で「行の配列」として読み、列の位置で特定する
        // (このシートは「新規」の後と「既存」の後にどちらも同名の「リピート」列があるため、
        // 名前だけのオブジェクト化だと後の列が前の列を上書きしてしまう)
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
        if (rows.length < 2) {
          setImportMsg("読み込める行がありませんでした。ファイルの中身をご確認ください。");
          return;
        }
        const cols = resolveColumns(rows[0]);

        let lastName = "";
        const parsed = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c) => String(c ?? "").trim() === "")) continue;

          const rawName = cols.nameIdx !== -1 ? String(row[cols.nameIdx] ?? "").trim() : "";
          if (rawName) lastName = rawName;
          const rawOrLast = rawName || lastName;
          const name = NAME_ALIASES[rawOrLast] || rawOrLast;
          if (!name) continue;

          const store =
            STAFF_STORE_MAP[name] ||
            (cols.storeIdx !== -1 ? String(row[cols.storeIdx] ?? "").trim() : "") ||
            importStore ||
            storeNames[0] ||
            "本店";

          const monthRaw = cols.monthIdx !== -1 ? row[cols.monthIdx] : "";
          const month = parseMonthLabel(monthRaw) || effectiveMonth || SEED_MONTH;

          let newC = 0;
          let newBookings = 0;
          const newFraction = cols.newFractionIdx !== -1 ? parseFraction(row[cols.newFractionIdx]) : null;
          if (newFraction) {
            newBookings = newFraction.num;
            newC = newFraction.den;
          } else {
            if (cols.newCIdx !== -1) newC = Math.round(numOnly(row[cols.newCIdx]));
            if (cols.newBookingsIdx !== -1) newBookings = Math.round(numOnly(row[cols.newBookingsIdx]));
          }

          let repeatC = 0;
          let repeatBookings = 0;
          const repeatFraction = cols.repeatFractionIdx !== -1 ? parseFraction(row[cols.repeatFractionIdx]) : null;
          if (repeatFraction) {
            repeatBookings = repeatFraction.num;
            repeatC = repeatFraction.den;
          } else {
            if (cols.repeatCIdx !== -1) repeatC = Math.round(numOnly(row[cols.repeatCIdx]));
            if (cols.repeatBookingsIdx !== -1) repeatBookings = Math.round(numOnly(row[cols.repeatBookingsIdx]));
          }

          const sales = cols.salesIdx !== -1 ? Math.round(numOnly(row[cols.salesIdx])) : 0;
          const productSales = cols.productSalesIdx !== -1 ? Math.round(numOnly(row[cols.productSalesIdx])) : 0;

          if (newC === 0 && repeatC === 0 && sales === 0 && productSales === 0) continue; // 空行はスキップ

          parsed.push({ store, name, month, newC, newBookings, repeatC, repeatBookings, sales, productSales });
        }

        if (parsed.length === 0) {
          setImportMsg("読み込める行がありませんでした。列名をご確認ください。");
        } else {
          // 同じ 店舗+スタッフ+月 の組み合わせは上書き（毎月同じファイルを読み込んでも重複しない）
          setStaffRows((prev) => {
            const byKey = new Map(prev.map((r) => [`${r.store}||${r.name}||${r.month}`, r]));
            parsed.forEach((p) => {
              const key = `${p.store}||${p.name}||${p.month}`;
              const existing = byKey.get(key);
              byKey.set(key, { ...p, id: existing ? existing.id : uid("imp") });
            });
            return Array.from(byKey.values());
          });
          setImportMsg(`${parsed.length}件のスタッフデータを取り込みました（同じ店舗・スタッフ・月のデータは上書きされます）。`);
        }
      } catch (err) {
        setImportMsg("読み込みに失敗しました。CSVまたはExcelファイルをご確認ください。");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const tabs = [{ id: "all", name: "全店舗" }, ...storeNames.map((n) => ({ id: n, name: n }))];

  return (
    <div
      style={{
        fontFamily: "'Noto Sans JP', sans-serif",
        background: PAPER,
        color: INK,
        minHeight: "100%",
        padding: "28px 26px 40px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;800&family=Noto+Sans+JP:wght@400;500;700&display=swap');
        .sd-tab { transition: all .15s ease; cursor: pointer; }
        .sd-tab:hover { background: ${PAPER_2}; }
        .sd-row:hover { background: ${PAPER_2}; }
        .sd-btn { cursor: pointer; transition: opacity .15s ease; border: none; }
        .sd-btn:hover { opacity: .85; }
        .recharts-tooltip-wrapper { outline: none; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={LOGO_ICON} alt="Uni. ロゴ" style={{ height: 44, width: "auto", objectFit: "contain" }} />
          <div>
            <h1 style={{ fontFamily: "'Shippori Mincho', serif", fontSize: 26, margin: 0, fontWeight: 600, color: INK, lineHeight: 1.15 }}>Uni.</h1>
            <div style={{ fontSize: 11.5, color: INK_SOFT, marginTop: 2 }}>髪質改善専門店 ・ 経営ダッシュボード</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <LoginBox user={user} isAdmin={isAdmin} />
          <SaveStatus loadState={loadState} saveState={saveState} />
          <div className="no-print" style={{ display: "flex", gap: 6, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 4 }}>
          <div
            className="sd-tab"
            onClick={() => setView("dashboard")}
            style={{
              padding: "8px 14px",
              borderRadius: 3,
              fontSize: 13,
              fontWeight: view === "dashboard" ? 700 : 500,
              background: view === "dashboard" ? INK : "transparent",
              color: view === "dashboard" ? PAPER : INK,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <LayoutDashboard size={14} /> ダッシュボード
          </div>
          <div
            className="sd-tab"
            onClick={() => setView("data")}
            style={{
              padding: "8px 14px",
              borderRadius: 3,
              fontSize: 13,
              fontWeight: view === "data" ? 700 : 500,
              background: view === "data" ? INK : "transparent",
              color: view === "data" ? PAPER : INK,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Table2 size={14} /> データ入力
          </div>
          </div>
        </div>
      </div>

      {view === "dashboard" ? (
        <>
          <div style={{ marginBottom: 22, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "inline-flex", gap: 6, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 4, flexWrap: "wrap" }}>
              {tabs.map((t) => (
                <div
                  key={t.id}
                  className="sd-tab"
                  onClick={() => setSelected(t.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 3,
                    fontSize: 13.5,
                    fontWeight: selected === t.id ? 700 : 500,
                    background: selected === t.id ? INK : "transparent",
                    color: selected === t.id ? PAPER : INK,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {t.name}
                  {STORE_TYPE[t.name] && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        padding: "2px 5px",
                        borderRadius: 3,
                        background: selected === t.id ? "rgba(255,255,255,0.16)" : STORE_TYPE[t.name] === "直営" ? "rgba(184,137,46,0.15)" : "rgba(47,93,87,0.12)",
                        color: selected === t.id ? PAPER : STORE_TYPE[t.name] === "直営" ? GOLD : TEAL,
                      }}
                    >
                      {STORE_TYPE[t.name]}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {availableMonths.length > 0 && (
              <select
                value={effectiveMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  background: "#fff",
                  border: `1px solid ${LINE}`,
                  borderRadius: 4,
                  padding: "9px 12px",
                  fontSize: 13.5,
                  fontFamily: "'Noto Sans JP', sans-serif",
                  color: INK,
                }}
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <button
              className="sd-btn no-print"
              onClick={() => window.print()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#fff",
                border: `1px solid ${LINE}`,
                color: INK,
                borderRadius: 4,
                padding: "9px 14px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Printer size={14} /> レポートを印刷・PDF保存
            </button>
          </div>

          {/* KPI row */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
            <KpiCard
              icon={<UserPlus size={16} />}
              label="次回予約率（新規客）"
              value={pct(kpi.newBookingRate)}
              sub={`新規 ${kpi.totalNew}人 中 ${kpi.totalNewBookings}人が次回予約`}
              delta={prevKpi && <Delta diff={(kpi.newBookingRate - prevKpi.newBookingRate) * 100} unit="pt" />}
              accent={TEAL}
            />
            <KpiCard
              icon={<CalendarCheck2 size={16} />}
              label="次回予約率（顧客）"
              value={pct(kpi.repeatBookingRate)}
              sub={`顧客 ${kpi.totalRepeat}人 中 ${kpi.totalRepeatBookings}人が次回予約`}
              delta={prevKpi && <Delta diff={(kpi.repeatBookingRate - prevKpi.repeatBookingRate) * 100} unit="pt" />}
              accent={GOLD}
            />
            <KpiCard
              icon={<JapaneseYen size={16} />}
              label="売上"
              value={yen(kpi.totalSales)}
              sub={selected === "all" ? "全店舗合計" : "当店合計"}
              delta={prevKpi && <Delta diff={kpi.totalSales - prevKpi.totalSales} unit="yen" />}
              accent={INK}
            />
            <KpiCard
              icon={<Wallet size={16} />}
              label="客単価"
              value={yen(kpi.avgSpend)}
              sub={`来店 ${kpi.totalCustomers}人あたりの売上`}
              delta={prevKpi && <Delta diff={kpi.avgSpend - prevKpi.avgSpend} unit="yen" />}
              accent={TEAL}
            />
          </div>
          {prevMonth && (
            <div style={{ fontSize: 11.5, color: INK_SOFT, marginTop: -14, marginBottom: 22 }}>
              前月比は {prevMonth} との比較です
            </div>
          )}

          {/* charts row */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <StoreIcon size={15} /> 店舗別売上
              </div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={storeCompareData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: INK_SOFT }} />
                  <YAxis tick={{ fontSize: 11, fill: INK_SOFT }} tickFormatter={(v) => `${Math.round(v / 10000)}万`} />
                  <Tooltip formatter={(v) => yen(v)} contentStyle={{ fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif" }} />
                  <Bar dataKey="売上" radius={[3, 3, 0, 0]}>
                    {storeCompareData.map((entry, i) => (
                      <Cell key={i} fill={entry.name === selected ? GOLD : PAPER_2} stroke={LINE} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* monthly trend */}
          {monthlyTrend.length > 1 && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
              <div style={{ flex: "1 1 320px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <TrendingUp size={15} /> 月次推移（次回予約率）
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={monthlyTrend} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: INK_SOFT }} />
                    <YAxis tick={{ fontSize: 11, fill: INK_SOFT }} tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} />
                    <Tooltip formatter={(v) => pct(v)} contentStyle={{ fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="repeatBookingRate" name="次回予約率（顧客）" stroke={GOLD} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="newBookingRate" name="次回予約率（新規）" stroke={TEAL} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={{ flex: "1 1 260px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <JapaneseYen size={15} /> 月次推移（売上）
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyTrend} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: INK_SOFT }} />
                    <YAxis tick={{ fontSize: 11, fill: INK_SOFT }} tickFormatter={(v) => `${Math.round(v / 10000)}万`} />
                    <Tooltip formatter={(v) => yen(v)} contentStyle={{ fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif" }} />
                    <Bar dataKey="totalSales" name="売上" fill={INK} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* staff list */}
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: "18px 4px 6px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, padding: "0 18px", display: "flex", alignItems: "center", gap: 6 }}>
              <Crown size={15} style={{ color: GOLD }} /> スタッフ・リピート状況
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                  <th style={{ textAlign: "left", padding: "8px 18px", fontWeight: 500 }}>スタッフ</th>
                  {selected === "all" && <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 500 }}>店舗</th>}
                  <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 500 }}>次回予約率（新規）</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 500 }}>次回予約率（顧客）</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 500 }}>客単価</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 500 }}>売上</th>
                  <th style={{ textAlign: "left", padding: "8px 18px", fontWeight: 500 }}>評価</th>
                </tr>
              </thead>
              <tbody>
                {rankedStaff.map((p, i) => (
                  <tr key={p.id} className="sd-row" style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td style={{ padding: "10px 18px", fontWeight: 600 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {p.name}
                        {p.anomalies.length > 0 && (
                          <AlertTriangle size={13} style={{ color: PLUM }} title={`データ要確認：${p.anomalies.join(" / ")}`} />
                        )}
                      </div>
                    </td>
                    {selected === "all" && <td style={{ padding: "10px 10px", color: INK_SOFT }}>{p.store}</td>}
                    <td style={{ padding: "10px 10px", color: INK_SOFT }}>{pct(p.newBookingRate)}</td>
                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 70, height: 6, background: PAPER_2, borderRadius: 3, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${Math.min(p.repeatBookingRate * 100, 100)}%`,
                              height: "100%",
                              background: p.repeatBookingRate >= REPEAT_BOOKING_THRESHOLD ? GOLD : TEAL,
                            }}
                          />
                        </div>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{pct(p.repeatBookingRate)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right", color: INK_SOFT, fontVariantNumeric: "tabular-nums" }}>{yen(p.avgSpend)}</td>
                    <td style={{ padding: "10px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{yen(p.totalSales)}</td>
                    <td style={{ padding: "10px 18px" }}>
                      <RatingBadge newBookingRate={p.newBookingRate} repeatBookingRate={p.repeatBookingRate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "10px 18px", fontSize: 11.5, color: INK_SOFT }}>
              王冠：次回予約率（新規）80%以上　かつ　次回予約率（顧客）90%以上　を両方達成
            </div>
          </div>
        </>
      ) : (
        <>
          {/* data entry view */}
          {!isAdmin && (
            <div style={{ fontSize: 12.5, color: INK_SOFT, background: PAPER_2, border: `1px solid ${LINE}`, borderRadius: 4, padding: "10px 14px", marginBottom: 16 }}>
              現在は閲覧のみです。データを編集するには右上の「編集者ログイン」からログインしてください。
            </div>
          )}
          {isAdmin && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <button
                className="sd-btn"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{ display: "flex", alignItems: "center", gap: 6, background: INK, color: PAPER, borderRadius: 4, padding: "9px 16px", fontSize: 13, fontWeight: 600 }}
              >
                <Upload size={14} /> CSV / Excelを取り込む
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
              <button
                className="sd-btn"
                onClick={downloadTemplate}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${LINE}`, color: INK, borderRadius: 4, padding: "9px 16px", fontSize: 13, fontWeight: 600 }}
              >
                <Download size={14} /> テンプレートをダウンロード
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: INK_SOFT }}>
                店舗名が列にない場合の取込先：
                <input
                  value={importStore}
                  onChange={(e) => setImportStore(e.target.value)}
                  placeholder={storeNames[0] || "例：渋谷店"}
                  style={{ border: `1px solid ${LINE}`, borderRadius: 4, padding: "6px 8px", fontSize: 12.5, fontFamily: "'Noto Sans JP', sans-serif", width: 110 }}
                />
              </div>
            </div>
          )}
          {importMsg && <div style={{ fontSize: 12.5, color: GOLD, fontWeight: 600, marginBottom: 10 }}>{importMsg}</div>}
          {isAdmin && (
            <div style={{ fontSize: 12, color: INK_SOFT, marginBottom: 20, lineHeight: 1.8 }}>
              共有いただいた「タイムスタンプ / お名前 / 店舗名 / 報告月 / 新規 / リピート / 既存 / リピート / 技術売上」の月次報告シートの列構成にそのまま対応しています（「リピート」列が2つありますが、直前が「新規」か「既存」かで自動的に区別します）。
              また、大藤佳奈子・佐々木梨紗・滝澤麻美・新井智子（旧報告名義「金谷智子」も同一人物として自動変換）・小野木慶子・中村晴美・難波順一朗の7名については、シート上の店舗名列の記載に関わらず、名前から酒津店／児島店／会津若松店／福山店／岡山店を自動判定します。
              シートを開いて「ファイル→ダウンロード→カンマ区切り形式（.csv）」で書き出し、そのファイルをここに取り込んでください。
              手入力の場合は、店舗 / スタッフ名 / 新規 / 新規次回予約 / リピート / リピート次回予約 / 技術売上 / 店販売上　の形式でも読み込めます（店販売上の列が無い場合は0として扱われます）。同じ店舗・スタッフ・月のデータは上書きされるため、毎月同じファイルを読み込み直しても重複しません。
              <br />
              サロンボードは外部向けのAPIを公開していないため、このアプリが自動で売上データを取得することはできません。スプレッドシートからCSV／Excelを出力し、そのファイルをここに取り込んでください。
            </div>
          )}

          {/* staff editable table */}
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: "18px 4px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>スタッフデータ{isAdmin ? "（手入力可）" : "（閲覧のみ）"}</div>
              {isAdmin && (
                <button
                  className="sd-btn"
                  onClick={addStaffRow}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: PAPER_2, color: INK, borderRadius: 4, padding: "6px 12px", fontSize: 12.5, fontWeight: 600 }}
                >
                  <Plus size={13} /> 行を追加
                </button>
              )}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                  <th style={{ textAlign: "left", padding: "6px 18px", fontWeight: 500 }}>店舗</th>
                  <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 500 }}>月</th>
                  <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 500 }}>スタッフ名</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 500 }}>新規</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 500 }}>新規次回予約</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 500 }}>リピート</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 500 }}>リピート次回予約</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 500 }}>技術売上</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 500 }}>店販売上</th>
                  <th style={{ padding: "6px 4px" }}></th>
                  {isAdmin && <th style={{ padding: "6px 18px" }}></th>}
                </tr>
              </thead>
              <tbody>
                {staffRows.map((r) => {
                  const issues = rowAnomalies(r);
                  return (
                    <tr
                      key={r.id}
                      className="sd-row"
                      style={{ borderBottom: `1px solid ${LINE}`, background: issues.length > 0 ? "rgba(184,137,46,0.08)" : "transparent" }}
                    >
                      <td style={{ padding: "4px 18px" }}>
                        <TextCell value={r.store} onChange={(v) => updateStaff(r.id, "store", v)} width={90} readOnly={!isAdmin} />
                      </td>
                      <td style={{ padding: "4px 10px" }}>
                        <TextCell value={r.month} onChange={(v) => updateStaff(r.id, "month", v)} width={90} readOnly={!isAdmin} />
                      </td>
                      <td style={{ padding: "4px 10px" }}>
                        <TextCell value={r.name} onChange={(v) => updateStaff(r.id, "name", v)} width={100} readOnly={!isAdmin} />
                      </td>
                      <td style={{ padding: "4px 10px" }}>
                        <NumberCell value={r.newC} onChange={(v) => updateStaff(r.id, "newC", v)} readOnly={!isAdmin} />
                      </td>
                      <td style={{ padding: "4px 10px" }}>
                        <NumberCell value={r.newBookings} onChange={(v) => updateStaff(r.id, "newBookings", v)} readOnly={!isAdmin} />
                      </td>
                      <td style={{ padding: "4px 10px" }}>
                        <NumberCell value={r.repeatC} onChange={(v) => updateStaff(r.id, "repeatC", v)} readOnly={!isAdmin} />
                      </td>
                      <td style={{ padding: "4px 10px" }}>
                        <NumberCell value={r.repeatBookings} onChange={(v) => updateStaff(r.id, "repeatBookings", v)} readOnly={!isAdmin} />
                      </td>
                      <td style={{ padding: "4px 10px" }}>
                        <NumberCell value={r.sales} onChange={(v) => updateStaff(r.id, "sales", v)} width={100} readOnly={!isAdmin} />
                      </td>
                      <td style={{ padding: "4px 10px" }}>
                        <NumberCell value={r.productSales || 0} onChange={(v) => updateStaff(r.id, "productSales", v)} width={100} readOnly={!isAdmin} />
                      </td>
                      <td style={{ padding: "4px 10px", width: 18 }}>
                        {issues.length > 0 && <AlertTriangle size={14} style={{ color: PLUM }} title={issues.join(" / ")} />}
                      </td>
                      {isAdmin && (
                        <td style={{ padding: "4px 18px" }}>
                          <Trash2 size={14} style={{ cursor: "pointer", color: INK_SOFT }} onClick={() => removeStaff(r.id)} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
