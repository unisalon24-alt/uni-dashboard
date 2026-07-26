import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { RefreshCw, AlertTriangle, JapaneseYen, Users, CalendarCheck2, Wallet, LogIn, LogOut, Award, Sparkles, Star, CalendarDays, TrendingUp, TrendingDown, Minus, Heart } from "lucide-react";
import { subscribeKarteAuthState, loginToKarte, logoutFromKarte, fetchAllVisits, KARTE_OWNER_EMAIL } from "./karteFirebase";

// App.jsx と揃えた配色 + 少しやさしさを足した差し色
const GOLD = "#B8892E";
const GOLD_LIGHT = "#E6C878";
const INK = "#241F19";
const INK_SOFT = "#5B5347";
const TEAL = "#2F5D57";
const PAPER_2 = "#F1E8D8";
const LINE = "#E3D6BC";
const PLUM = "#6E4A56";
const ROSE = "#B4657A";
const SKY = "#5E86A1";
const CARD_ACCENTS = [GOLD, TEAL, ROSE, SKY, PLUM];

const STORE_ORDER = ["児島店", "酒津店", "会津若松店", "岡山店", "福山店"];

const yen = (n) => `¥${Math.round(n || 0).toLocaleString("ja-JP")}`;
const pct = (n) => `${((n || 0) * 100).toFixed(1)}%`;

function monthLabelOf(dateStr) {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}年${Number(m[2])}月`;
}
function yearOf(dateStr) {
  const m = String(dateStr || "").match(/^(\d{4})-/);
  return m ? Number(m[1]) : null;
}
function dayOf(dateStr) {
  const m = String(dateStr || "").match(/^\d{4}-\d{2}-(\d{2})/);
  return m ? Number(m[1]) : null;
}
function monthSortKey(label) {
  const m = String(label || "").match(/(\d+)年(\d+)月/);
  return m ? Number(m[1]) * 12 + Number(m[2]) : 0;
}

// 来店1件の金額を「技術売上」「店販売上」「合計」に分解する
// (カルテアプリの computeRegiAmounts と同じロジック)
function splitVisitAmounts(v) {
  const total = Number(v.price) || 0;
  const buppan = (v.purchasedProducts || []).reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.qty) || 1), 0);
  const shisen = total - buppan;
  return { shisen, buppan, total };
}

// 顧客ごとの最も古い来店日を求め、その日の来店だけを「新規」とみなす
function attachIsNew(visits) {
  const earliest = new Map();
  visits.forEach((v) => {
    if (!v.customerId || !v.date) return;
    const cur = earliest.get(v.customerId);
    if (!cur || v.date < cur) earliest.set(v.customerId, v.date);
  });
  return visits.map((v) => ({
    ...v,
    __isNew: v.customerId && v.date ? v.date === earliest.get(v.customerId) : null,
  }));
}

function aggregate(visits) {
  let technicalSales = 0,
    productSales = 0,
    totalSales = 0,
    newCount = 0,
    repeatCount = 0,
    bookedNext = 0,
    totalCount = 0;
  visits.forEach((v) => {
    const { shisen, buppan, total } = splitVisitAmounts(v);
    technicalSales += shisen;
    productSales += buppan;
    totalSales += total;
    totalCount += 1;
    if (v.__isNew === true) newCount += 1;
    else if (v.__isNew === false) repeatCount += 1;
    if (v.nextBooked) bookedNext += 1;
  });
  return {
    technicalSales,
    productSales,
    totalSales,
    newCount,
    repeatCount,
    totalCount,
    avgSpend: totalCount > 0 ? totalSales / totalCount : 0,
    nextBookingRate: totalCount > 0 ? bookedNext / totalCount : 0,
  };
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function weekdayOf(dateStr) {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getDay();
}

// 曜日ごとの平均売上・来店数を求める（どの曜日が忙しいか、をやわらかく見せる）
function weekdayBreakdown(visits) {
  const buckets = WEEKDAY_LABELS.map((label, i) => ({ label, i, totalSales: 0, days: new Set(), count: 0 }));
  visits.forEach((v) => {
    const w = weekdayOf(v.date);
    if (w === null) return;
    const { total } = splitVisitAmounts(v);
    buckets[w].totalSales += total;
    buckets[w].days.add(v.date);
    buckets[w].count += 1;
  });
  return buckets.map((b) => ({ label: b.label, avgSales: b.days.size > 0 ? b.totalSales / b.days.size : 0, count: b.count }));
}

// 期間内で一番人気だったメニュー・商品・スタッフ・曜日を抜き出す（ハイライト表示用）
function pickHighlights(visits) {
  const menuTotals = new Map();
  const productTotals = new Map();
  const staffTotals = new Map();
  visits.forEach((v) => {
    const { shisen, buppan } = splitVisitAmounts(v);
    if (v.menu) menuTotals.set(v.menu, (menuTotals.get(v.menu) || 0) + shisen);
    if (v.staff) staffTotals.set(v.staff, (staffTotals.get(v.staff) || 0) + shisen + buppan);
    (v.purchasedProducts || []).forEach((p) => {
      const amount = (Number(p.price) || 0) * (Number(p.qty) || 1);
      if (p.name) productTotals.set(p.name, (productTotals.get(p.name) || 0) + amount);
    });
  });
  const top = (map) => (map.size === 0 ? null : Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]);
  const weekday = weekdayBreakdown(visits).sort((a, b) => b.avgSales - a.avgSales)[0];
  return {
    bestMenu: top(menuTotals),
    bestProduct: top(productTotals),
    bestStaff: top(staffTotals),
    busiestWeekday: weekday && weekday.avgSales > 0 ? weekday : null,
  };
}

function Delta({ diff, label }) {
  if (diff === null || diff === undefined || Number.isNaN(diff) || diff === 0) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: INK_SOFT }}>
        <Minus size={11} /> {label}と同水準
      </span>
    );
  }
  const up = diff > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: up ? TEAL : ROSE, fontWeight: 700 }}>
      <Icon size={11} /> {up ? "+" : "-"}¥{Math.round(Math.abs(diff)).toLocaleString("ja-JP")} （{label}比）
    </span>
  );
}

function KpiCard({ icon, label, value, sub, accent, delta }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${LINE}`,
        borderRadius: 18,
        padding: "20px 22px",
        flex: "1 1 210px",
        minWidth: 210,
        boxShadow: "0 2px 10px rgba(36,31,25,0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: `${accent}1A`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <span style={{ fontSize: 12.5, color: INK_SOFT, letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontFamily: "'Shippori Mincho', serif", fontSize: 27, color: INK, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: INK_SOFT, marginTop: 7 }}>{sub}</div>}
      {delta && <div style={{ marginTop: 6 }}>{delta}</div>}
    </div>
  );
}

// 「今月のハイライト」など、うれしい発見をひとこと添えて見せる小さなカード
function HighlightCard({ icon, accent, title, value, note }) {
  if (!value) return null;
  return (
    <div
      style={{
        flex: "1 1 220px",
        minWidth: 220,
        background: `linear-gradient(135deg, ${accent}14, #fff 70%)`,
        border: `1px solid ${LINE}`,
        borderRadius: 18,
        padding: "16px 18px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: accent,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11.5, color: INK_SOFT, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{value}</div>
        {note && <div style={{ fontSize: 11.5, color: INK_SOFT, marginTop: 3 }}>{note}</div>}
      </div>
    </div>
  );
}

// メニュー・商品それぞれの「合計ランキング」を、棒つきのやさしい一覧で見せる
function RankingList({ rows, nameKey, unit = "yen" }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div>
      {rows.map((r, i) => (
        <div key={r[nameKey]} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : "none" }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11.5,
              fontWeight: 700,
              flexShrink: 0,
              background: i === 0 ? GOLD_LIGHT : i === 1 ? "#D8D2C4" : i === 2 ? "#E3C7A8" : PAPER_2,
              color: i < 3 ? INK : INK_SOFT,
            }}
          >
            {i + 1}
          </div>
          <div style={{ flex: "0 0 180px", fontSize: 13, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r[nameKey]}</div>
          <div style={{ flex: 1, background: PAPER_2, borderRadius: 8, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(4, (r.total / max) * 100)}%`, height: "100%", background: i === 0 ? GOLD : CARD_ACCENTS[i % CARD_ACCENTS.length], borderRadius: 8 }} />
          </div>
          <div style={{ flex: "0 0 90px", textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums", color: INK }}>{unit === "yen" ? yen(r.total) : r.total}</div>
        </div>
      ))}
    </div>
  );
}

export default function KarteAnalytics() {
  const [karteUser, setKarteUser] = useState(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [visits, setVisits] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  const [selectedStore, setSelectedStore] = useState("all");
  const [period, setPeriod] = useState("month"); // "day" | "month" | "year"
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showDailyTable, setShowDailyTable] = useState(false);
  const [showMenuDetail, setShowMenuDetail] = useState(false);
  const [showProductDetail, setShowProductDetail] = useState(false);

  useEffect(() => {
    const unsub = subscribeKarteAuthState((u) => setKarteUser(u));
    return () => unsub && unsub();
  }, []);

  const doLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      await loginToKarte(password);
      setPassword("");
    } catch (err) {
      setLoginError("ログインできませんでした。パスワードをご確認ください。");
    } finally {
      setLoggingIn(false);
    }
  };

  const doFetch = async () => {
    setFetching(true);
    setFetchError("");
    try {
      const rows = await fetchAllVisits();
      setVisits(attachIsNew(rows));
      setLastFetchedAt(new Date());
    } catch (err) {
      setFetchError("来店データの取得に失敗しました。Firestoreのルール設定をご確認ください。");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (karteUser) doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [karteUser]);

  const storeFiltered = useMemo(
    () => (selectedStore === "all" ? visits : visits.filter((v) => v.store === selectedStore)),
    [visits, selectedStore]
  );

  const availableMonths = useMemo(() => {
    const seen = new Set();
    storeFiltered.forEach((v) => {
      const m = monthLabelOf(v.date);
      if (m) seen.add(m);
    });
    return Array.from(seen).sort((a, b) => monthSortKey(b) - monthSortKey(a));
  }, [storeFiltered]);

  const availableYears = useMemo(() => {
    const seen = new Set();
    storeFiltered.forEach((v) => {
      const y = yearOf(v.date);
      if (y) seen.add(y);
    });
    return Array.from(seen).sort((a, b) => b - a);
  }, [storeFiltered]);

  const effectiveMonth = availableMonths.includes(selectedMonth) ? selectedMonth : availableMonths[0] || "";
  const effectiveYear = availableYears.includes(Number(selectedYear)) ? Number(selectedYear) : availableYears[0] || null;

  // 期間ごとの対象データ
  const periodVisits = useMemo(() => {
    if (period === "year") return storeFiltered.filter((v) => yearOf(v.date) === effectiveYear);
    return storeFiltered.filter((v) => monthLabelOf(v.date) === effectiveMonth);
  }, [storeFiltered, period, effectiveMonth, effectiveYear]);

  const kpi = useMemo(() => aggregate(periodVisits), [periodVisits]);

  // 前月・前年との比較（月次/年間モードのみ）
  const availableMonthsAsc = useMemo(() => [...availableMonths].sort((a, b) => monthSortKey(a) - monthSortKey(b)), [availableMonths]);
  const prevKpi = useMemo(() => {
    if (period === "year") {
      if (!effectiveYear || !availableYears.includes(effectiveYear - 1)) return null;
      return aggregate(storeFiltered.filter((v) => yearOf(v.date) === effectiveYear - 1));
    }
    if (period === "month") {
      const idx = availableMonthsAsc.indexOf(effectiveMonth);
      if (idx <= 0) return null;
      return aggregate(storeFiltered.filter((v) => monthLabelOf(v.date) === availableMonthsAsc[idx - 1]));
    }
    return null;
  }, [period, effectiveYear, availableYears, effectiveMonth, availableMonthsAsc, storeFiltered]);
  const deltaLabel = period === "year" ? "前年" : "前月";

  // 今月のハイライト（一番人気のメニュー・商品・スタッフ・曜日）
  const highlights = useMemo(() => pickHighlights(periodVisits), [periodVisits]);

  // 曜日別の平均売上（忙しい曜日をやわらかく見せる）
  const weekdayData = useMemo(() => weekdayBreakdown(periodVisits), [periodVisits]);

  // 日別テーブル・グラフ用（選択中の月の日ごと集計）
  const dailyRows = useMemo(() => {
    const monthVisits = storeFiltered.filter((v) => monthLabelOf(v.date) === effectiveMonth);
    const byDay = new Map();
    monthVisits.forEach((v) => {
      const d = dayOf(v.date);
      if (!d) return;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(v);
    });
    return Array.from(byDay.entries())
      .map(([day, rows]) => ({ day, ...aggregate(rows) }))
      .sort((a, b) => a.day - b.day);
  }, [storeFiltered, effectiveMonth]);

  // 年間の月別集計（KPIテーブル用）
  const yearMonthlyRows = useMemo(() => {
    const yearVisits = storeFiltered.filter((v) => yearOf(v.date) === effectiveYear);
    const byMonth = new Map();
    yearVisits.forEach((v) => {
      const m = monthLabelOf(v.date);
      if (!m) return;
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(v);
    });
    return Array.from(byMonth.entries())
      .map(([month, rows]) => ({ month, ...aggregate(rows) }))
      .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));
  }, [storeFiltered, effectiveYear]);

  // メニュー別 × 月別（選択中の年）
  const menuMonthlyTable = useMemo(() => {
    const yearVisits = storeFiltered.filter((v) => yearOf(v.date) === effectiveYear);
    const months = Array.from(new Set(yearVisits.map((v) => monthLabelOf(v.date)).filter(Boolean))).sort((a, b) => monthSortKey(a) - monthSortKey(b));
    const menus = Array.from(new Set(yearVisits.map((v) => v.menu).filter(Boolean)));
    const table = menus.map((menu) => {
      const row = { menu, total: 0 };
      months.forEach((m) => (row[m] = 0));
      yearVisits
        .filter((v) => v.menu === menu)
        .forEach((v) => {
          const m = monthLabelOf(v.date);
          const { shisen } = splitVisitAmounts(v);
          row[m] = (row[m] || 0) + shisen;
          row.total += shisen;
        });
      return row;
    });
    return { months, table: table.sort((a, b) => b.total - a.total) };
  }, [storeFiltered, effectiveYear]);

  // 商品別 × 月別（選択中の年）
  const productMonthlyTable = useMemo(() => {
    const yearVisits = storeFiltered.filter((v) => yearOf(v.date) === effectiveYear);
    const months = Array.from(new Set(yearVisits.map((v) => monthLabelOf(v.date)).filter(Boolean))).sort((a, b) => monthSortKey(a) - monthSortKey(b));
    const totals = new Map();
    yearVisits.forEach((v) => {
      const m = monthLabelOf(v.date);
      (v.purchasedProducts || []).forEach((p) => {
        const amount = (Number(p.price) || 0) * (Number(p.qty) || 1);
        const key = p.name || "(商品名未入力)";
        if (!totals.has(key)) {
          const row = { product: key, total: 0 };
          months.forEach((mo) => (row[mo] = 0));
          totals.set(key, row);
        }
        const row = totals.get(key);
        row[m] = (row[m] || 0) + amount;
        row.total += amount;
      });
    });
    return { months, table: Array.from(totals.values()).sort((a, b) => b.total - a.total) };
  }, [storeFiltered, effectiveYear]);

  // スタッフ別（選択中の期間）
  const staffTable = useMemo(() => {
    const byStaff = new Map();
    periodVisits.forEach((v) => {
      const key = v.staff || "(未入力)";
      if (!byStaff.has(key)) byStaff.set(key, []);
      byStaff.get(key).push(v);
    });
    return Array.from(byStaff.entries())
      .map(([staff, rows]) => ({ staff, ...aggregate(rows) }))
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [periodVisits]);

  const storeNames = useMemo(() => STORE_ORDER.filter((s) => visits.some((v) => v.store === s)), [visits]);

  // ---- 未ログイン ----
  if (!karteUser) {
    return (
      <div style={{ maxWidth: 420, margin: "40px auto", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>来店データ分析（カルテ連携）</div>
        <div style={{ fontSize: 12.5, color: INK_SOFT, marginBottom: 18, lineHeight: 1.7 }}>
          カルテアプリ（uni-karte）の来店記録をもとに、日別・月別・年間・メニュー別・商品別・スタッフ別の売上を自動で集計します。全店舗を横断して閲覧できる専用アカウントでログインしてください。
        </div>
        <form onSubmit={doLogin}>
          <div style={{ fontSize: 12, color: INK_SOFT, marginBottom: 4 }}>ログインID：{KARTE_OWNER_EMAIL}</div>
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 10 }}
          />
          {loginError && <div style={{ fontSize: 12, color: PLUM, marginBottom: 10 }}>{loginError}</div>}
          <button
            type="submit"
            disabled={loggingIn}
            style={{ width: "100%", background: INK, color: "#FBF7EF", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <LogIn size={14} /> {loggingIn ? "ログイン中…" : "ログイン"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          background: `linear-gradient(120deg, ${GOLD}14, ${ROSE}10 60%, #fff)`,
          border: `1px solid ${LINE}`,
          borderRadius: 18,
          padding: "18px 22px",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Sparkles size={20} style={{ color: GOLD, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: INK, fontFamily: "'Shippori Mincho', serif" }}>来店データ分析</div>
          <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 2 }}>カルテの記録から、日々の頑張りが自動でかたちになります。気になる数字をのぞいてみましょう。</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: INK_SOFT }}>
          {KARTE_OWNER_EMAIL} でログイン中
          {lastFetchedAt && ` ・ 最終取得：${lastFetchedAt.toLocaleString("ja-JP")}`}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={doFetch}
            disabled={fetching}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${LINE}`, color: INK, borderRadius: 999, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
          >
            <RefreshCw size={13} /> {fetching ? "取得中…" : "最新データを取得"}
          </button>
          <button
            onClick={() => logoutFromKarte()}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${LINE}`, color: INK_SOFT, borderRadius: 999, padding: "7px 16px", fontSize: 12.5, cursor: "pointer" }}
          >
            <LogOut size={13} /> ログアウト
          </button>
        </div>
      </div>

      {fetchError && (
        <div style={{ fontSize: 12.5, color: PLUM, background: "rgba(184,137,46,0.08)", border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} /> {fetchError}
        </div>
      )}

      {visits.length === 0 && !fetching && !fetchError && (
        <div style={{ fontSize: 12.5, color: INK_SOFT, marginBottom: 16 }}>まだ来店データがありません。</div>
      )}

      {visits.length > 0 && (
        <>
          {/* store tabs + period toggle */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "inline-flex", gap: 6, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 999, padding: 4, flexWrap: "wrap" }}>
              {[{ id: "all", name: "全店舗" }, ...storeNames.map((s) => ({ id: s, name: s }))].map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedStore(t.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 999,
                    fontSize: 13.5,
                    fontWeight: selectedStore === t.id ? 700 : 500,
                    background: selectedStore === t.id ? INK : "transparent",
                    color: selectedStore === t.id ? "#FBF7EF" : INK,
                    cursor: "pointer",
                  }}
                >
                  {t.name}
                </div>
              ))}
            </div>
            <div style={{ display: "inline-flex", gap: 6, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 999, padding: 4 }}>
              {[
                { id: "day", name: "日別" },
                { id: "month", name: "月次" },
                { id: "year", name: "年間" },
              ].map((t) => (
                <div
                  key={t.id}
                  onClick={() => setPeriod(t.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: period === t.id ? 700 : 500,
                    background: period === t.id ? INK : "transparent",
                    color: period === t.id ? "#FBF7EF" : INK,
                    cursor: "pointer",
                  }}
                >
                  {t.name}
                </div>
              ))}
            </div>
            {period !== "year" && availableMonths.length > 0 && (
              <select
                value={effectiveMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 999, padding: "9px 16px", fontSize: 13.5, color: INK }}
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            {period === "year" && availableYears.length > 0 && (
              <select
                value={effectiveYear || ""}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 999, padding: "9px 16px", fontSize: 13.5, color: INK }}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* KPI cards */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
            <KpiCard
              icon={<JapaneseYen size={16} />}
              label="合計売上"
              value={yen(kpi.totalSales)}
              sub={`技術 ${yen(kpi.technicalSales)}・店販 ${yen(kpi.productSales)}`}
              accent={GOLD}
              delta={prevKpi && <Delta diff={kpi.totalSales - prevKpi.totalSales} label={deltaLabel} />}
            />
            <KpiCard
              icon={<Wallet size={16} />}
              label="客単価"
              value={yen(kpi.avgSpend)}
              sub={`来店 ${kpi.totalCount}件`}
              accent={TEAL}
              delta={prevKpi && <Delta diff={kpi.avgSpend - prevKpi.avgSpend} label={deltaLabel} />}
            />
            <KpiCard icon={<Users size={16} />} label="新規／既存" value={`${kpi.newCount} ／ ${kpi.repeatCount}`} sub="来店件数ベース" accent={ROSE} />
            <KpiCard icon={<CalendarCheck2 size={16} />} label="次回予約率" value={pct(kpi.nextBookingRate)} sub={`${kpi.totalCount}件中の割合`} accent={SKY} />
          </div>

          {/* highlights */}
          {(highlights.bestMenu || highlights.bestProduct || highlights.bestStaff || highlights.busiestWeekday) && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={15} style={{ color: GOLD }} /> {period === "year" ? `${effectiveYear}年` : effectiveMonth}のハイライト
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <HighlightCard icon={<Award size={17} />} accent={GOLD} title="一番人気のメニュー" value={highlights.bestMenu ? highlights.bestMenu[0] : null} note={highlights.bestMenu ? yen(highlights.bestMenu[1]) : ""} />
                <HighlightCard icon={<Sparkles size={17} />} accent={ROSE} title="よく売れた商品" value={highlights.bestProduct ? highlights.bestProduct[0] : null} note={highlights.bestProduct ? yen(highlights.bestProduct[1]) : ""} />
                <HighlightCard icon={<Star size={17} />} accent={SKY} title="売上トップのスタッフ" value={highlights.bestStaff ? highlights.bestStaff[0] : null} note={highlights.bestStaff ? yen(highlights.bestStaff[1]) : ""} />
                <HighlightCard
                  icon={<CalendarDays size={17} />}
                  accent={TEAL}
                  title="一番忙しい曜日"
                  value={highlights.busiestWeekday ? `${highlights.busiestWeekday.label}曜日` : null}
                  note={highlights.busiestWeekday ? `平均 ${yen(highlights.busiestWeekday.avgSales)}／日` : ""}
                />
              </div>
            </div>
          )}

          {/* new/repeat donut + weekday chart */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
            {kpi.newCount + kpi.repeatCount > 0 && (
              <div style={{ flex: "1 1 260px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Heart size={14} style={{ color: ROSE }} /> 新規・既存のバランス
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={[{ name: "新規", value: kpi.newCount }, { name: "既存", value: kpi.repeatCount }]} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={3}>
                      <Cell fill={SKY} />
                      <Cell fill={GOLD} />
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {weekdayData.some((w) => w.avgSales > 0) && (
              <div style={{ flex: "1 1 320px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <CalendarDays size={14} style={{ color: TEAL }} /> 曜日別の平均売上
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={weekdayData} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: INK_SOFT }} />
                    <YAxis tick={{ fontSize: 11, fill: INK_SOFT }} tickFormatter={(v) => `${Math.round(v / 10000)}万`} />
                    <Tooltip formatter={(v) => yen(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="avgSales" name="平均売上" radius={[6, 6, 0, 0]}>
                      {weekdayData.map((w, i) => (
                        <Cell key={i} fill={CARD_ACCENTS[i % CARD_ACCENTS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* daily chart + table (日別モード) */}
          {period === "day" && dailyRows.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, marginBottom: 20, overflowX: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{effectiveMonth} 日別売上（{selectedStore === "all" ? "全店舗" : selectedStore}）</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyRows} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: INK_SOFT }} tickFormatter={(d) => `${d}日`} />
                  <YAxis tick={{ fontSize: 11, fill: INK_SOFT }} tickFormatter={(v) => `${Math.round(v / 10000)}万`} />
                  <Tooltip formatter={(v) => yen(v)} labelFormatter={(d) => `${d}日`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="totalSales" name="売上" fill={GOLD} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <button
                onClick={() => setShowDailyTable((v) => !v)}
                style={{ marginTop: 12, background: "transparent", border: "none", color: TEAL, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
              >
                {showDailyTable ? "日ごとの表を閉じる ▲" : "日ごとの表で詳しく見る ▼"}
              </button>
              {showDailyTable && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 14, minWidth: 640 }}>
                  <thead>
                    <tr style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>日</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>技術売上</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>店販売上</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>合計売上</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>客単価</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>来店数</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>新規</th>
                      <th style={{ textAlign: "right", padding: "8px 10px" }}>既存</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map((d, i) => (
                      <tr key={d.day} style={{ background: i % 2 === 1 ? PAPER_2 : "transparent", borderRadius: 8 }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, borderRadius: "8px 0 0 8px" }}>{d.day}日</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: INK_SOFT }}>{yen(d.technicalSales)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: INK_SOFT }}>{yen(d.productSales)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>{yen(d.totalSales)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: INK_SOFT }}>{yen(d.avgSpend)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>{d.totalCount}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>{d.newCount}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", borderRadius: "0 8px 8px 0" }}>{d.repeatCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* annual monthly table (年間モード) */}
          {period === "year" && yearMonthlyRows.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, marginBottom: 20, overflowX: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{effectiveYear}年 月別内訳（{selectedStore === "all" ? "全店舗" : selectedStore}）</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
                <thead>
                  <tr style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                    <th style={{ textAlign: "left", padding: "6px 10px" }}>月</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>技術売上</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>店販売上</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>合計売上</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>客単価</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>来店数</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>次回予約率</th>
                  </tr>
                </thead>
                <tbody>
                  {yearMonthlyRows.map((m, i) => (
                    <tr key={m.month} style={{ background: i % 2 === 1 ? PAPER_2 : "transparent" }}>
                      <td style={{ padding: "6px 10px", fontWeight: 600 }}>{m.month}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: INK_SOFT }}>{yen(m.technicalSales)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: INK_SOFT }}>{yen(m.productSales)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>{yen(m.totalSales)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: INK_SOFT }}>{yen(m.avgSpend)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>{m.totalCount}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: INK_SOFT }}>{pct(m.nextBookingRate)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${GOLD}`, fontWeight: 700, background: PAPER_2 }}>
                    <td style={{ padding: "8px 10px" }}>合計</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{yen(kpi.technicalSales)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{yen(kpi.productSales)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{yen(kpi.totalSales)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{yen(kpi.avgSpend)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{kpi.totalCount}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{pct(kpi.nextBookingRate)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* staff table */}
          {staffTable.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, marginBottom: 20, overflowX: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>スタッフ別（{period === "year" ? `${effectiveYear}年` : effectiveMonth}）</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
                <thead>
                  <tr style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                    <th style={{ textAlign: "left", padding: "6px 10px" }}>スタッフ</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>技術売上</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>店販売上</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>合計売上</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>来店数</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>次回予約率</th>
                  </tr>
                </thead>
                <tbody>
                  {staffTable.map((s, i) => (
                    <tr key={s.staff} style={{ background: i % 2 === 1 ? PAPER_2 : "transparent" }}>
                      <td style={{ padding: "6px 10px", fontWeight: 600 }}>{s.staff}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: INK_SOFT }}>{yen(s.technicalSales)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: INK_SOFT }}>{yen(s.productSales)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>{yen(s.totalSales)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>{s.totalCount}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: INK_SOFT }}>{pct(s.nextBookingRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* menu breakdown (常に選択中の年で表示) */}
          {menuMonthlyTable.table.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, marginBottom: 20, overflowX: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>メニュー別ランキング（{effectiveYear}年・技術売上）</div>
              <div style={{ fontSize: 11.5, color: INK_SOFT, marginBottom: 14 }}>人気メニューが多い順に並んでいます。年間タブで年を切り替えられます。</div>
              <RankingList rows={menuMonthlyTable.table} nameKey="menu" />
              <button
                onClick={() => setShowMenuDetail((v) => !v)}
                style={{ marginTop: 14, background: "transparent", border: "none", color: TEAL, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
              >
                {showMenuDetail ? "月ごとの内訳を閉じる ▲" : "月ごとの内訳を見る ▼"}
              </button>
              {showMenuDetail && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720, marginTop: 14 }}>
                  <thead>
                    <tr style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>メニュー</th>
                      {menuMonthlyTable.months.map((m) => (
                        <th key={m} style={{ textAlign: "right", padding: "8px 8px", whiteSpace: "nowrap" }}>
                          {m.replace(/^\d+年/, "")}
                        </th>
                      ))}
                      <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700 }}>合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuMonthlyTable.table.map((row, i) => (
                      <tr key={row.menu} style={{ background: i % 2 === 1 ? PAPER_2 : "transparent" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, borderRadius: "8px 0 0 8px" }}>{row.menu}</td>
                        {menuMonthlyTable.months.map((m) => (
                          <td key={m} style={{ padding: "8px 8px", textAlign: "right", color: INK_SOFT }}>
                            {row[m] ? yen(row[m]) : "―"}
                          </td>
                        ))}
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, borderRadius: "0 8px 8px 0" }}>{yen(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* product breakdown */}
          {productMonthlyTable.table.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, marginBottom: 20, overflowX: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>商品別ランキング（{effectiveYear}年・店販売上）</div>
              <div style={{ fontSize: 11.5, color: INK_SOFT, marginBottom: 14 }}>よく売れている商品が多い順に並んでいます。</div>
              <RankingList rows={productMonthlyTable.table} nameKey="product" />
              <button
                onClick={() => setShowProductDetail((v) => !v)}
                style={{ marginTop: 14, background: "transparent", border: "none", color: TEAL, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
              >
                {showProductDetail ? "月ごとの内訳を閉じる ▲" : "月ごとの内訳を見る ▼"}
              </button>
              {showProductDetail && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720, marginTop: 14 }}>
                  <thead>
                    <tr style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>商品名</th>
                      {productMonthlyTable.months.map((m) => (
                        <th key={m} style={{ textAlign: "right", padding: "8px 8px", whiteSpace: "nowrap" }}>
                          {m.replace(/^\d+年/, "")}
                        </th>
                      ))}
                      <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700 }}>合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productMonthlyTable.table.map((row, i) => (
                      <tr key={row.product} style={{ background: i % 2 === 1 ? PAPER_2 : "transparent" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, borderRadius: "8px 0 0 8px" }}>{row.product}</td>
                        {productMonthlyTable.months.map((m) => (
                          <td key={m} style={{ padding: "8px 8px", textAlign: "right", color: INK_SOFT }}>
                            {row[m] ? yen(row[m]) : "―"}
                          </td>
                        ))}
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, borderRadius: "0 8px 8px 0" }}>{yen(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
