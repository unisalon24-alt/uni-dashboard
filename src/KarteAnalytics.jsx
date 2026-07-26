import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw, AlertTriangle, JapaneseYen, Users, CalendarCheck2, Wallet, LogIn, LogOut } from "lucide-react";
import { subscribeKarteAuthState, loginToKarte, logoutFromKarte, fetchAllVisits, KARTE_OWNER_EMAIL } from "./karteFirebase";

// App.jsx と揃えた配色
const GOLD = "#B8892E";
const INK = "#241F19";
const INK_SOFT = "#5B5347";
const TEAL = "#2F5D57";
const PAPER_2 = "#F1E8D8";
const LINE = "#E3D6BC";
const PLUM = "#6E4A56";

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

function KpiCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{ background: PAPER_2, border: `1px solid ${LINE}`, borderRadius: 4, padding: "18px 20px", flex: "1 1 200px", minWidth: 200, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: INK_SOFT, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 12, letterSpacing: 1 }}>{label}</span>
      </div>
      <div style={{ fontFamily: "'Shippori Mincho', serif", fontSize: 28, color: INK, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: INK_SOFT, marginTop: 5 }}>{sub}</div>}
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
      <div style={{ maxWidth: 420, margin: "40px auto", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 28 }}>
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
            style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${LINE}`, borderRadius: 4, padding: "9px 10px", fontSize: 13, marginBottom: 10 }}
          />
          {loginError && <div style={{ fontSize: 12, color: PLUM, marginBottom: 10 }}>{loginError}</div>}
          <button
            type="submit"
            disabled={loggingIn}
            style={{ width: "100%", background: INK, color: "#FBF7EF", border: "none", borderRadius: 4, padding: "10px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <LogIn size={14} /> {loggingIn ? "ログイン中…" : "ログイン"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: INK_SOFT }}>
          {KARTE_OWNER_EMAIL} でログイン中
          {lastFetchedAt && ` ・ 最終取得：${lastFetchedAt.toLocaleString("ja-JP")}`}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={doFetch}
            disabled={fetching}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${LINE}`, color: INK, borderRadius: 4, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
          >
            <RefreshCw size={13} /> {fetching ? "取得中…" : "最新データを取得"}
          </button>
          <button
            onClick={() => logoutFromKarte()}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${LINE}`, color: INK_SOFT, borderRadius: 4, padding: "7px 14px", fontSize: 12.5, cursor: "pointer" }}
          >
            <LogOut size={13} /> ログアウト
          </button>
        </div>
      </div>

      {fetchError && (
        <div style={{ fontSize: 12.5, color: PLUM, background: "rgba(184,137,46,0.08)", border: `1px solid ${LINE}`, borderRadius: 4, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
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
            <div style={{ display: "inline-flex", gap: 6, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 4, flexWrap: "wrap" }}>
              {[{ id: "all", name: "全店舗" }, ...storeNames.map((s) => ({ id: s, name: s }))].map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedStore(t.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 3,
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
            <div style={{ display: "inline-flex", gap: 6, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 4 }}>
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
                    borderRadius: 3,
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
                style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: "9px 12px", fontSize: 13.5, color: INK }}
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
                style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: "9px 12px", fontSize: 13.5, color: INK }}
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
            <KpiCard icon={<JapaneseYen size={16} />} label="合計売上" value={yen(kpi.totalSales)} sub={`技術 ${yen(kpi.technicalSales)}・店販 ${yen(kpi.productSales)}`} accent={INK} />
            <KpiCard icon={<Wallet size={16} />} label="客単価" value={yen(kpi.avgSpend)} sub={`来店 ${kpi.totalCount}件`} accent={TEAL} />
            <KpiCard icon={<Users size={16} />} label="新規／既存" value={`${kpi.newCount} ／ ${kpi.repeatCount}`} sub="来店件数ベース" accent={PLUM} />
            <KpiCard icon={<CalendarCheck2 size={16} />} label="次回予約率" value={pct(kpi.nextBookingRate)} sub={`${kpi.totalCount}件中の割合`} accent={GOLD} />
          </div>

          {/* daily chart + table (日別モード) */}
          {period === "day" && dailyRows.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 18, marginBottom: 22, overflowX: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{effectiveMonth} 日別売上（{selectedStore === "all" ? "全店舗" : selectedStore}）</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyRows} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: INK_SOFT }} tickFormatter={(d) => `${d}日`} />
                  <YAxis tick={{ fontSize: 11, fill: INK_SOFT }} tickFormatter={(v) => `${Math.round(v / 10000)}万`} />
                  <Tooltip formatter={(v) => yen(v)} labelFormatter={(d) => `${d}日`} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="totalSales" name="売上" fill={INK} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 16, minWidth: 640 }}>
                <thead>
                  <tr style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                    <th style={{ textAlign: "left", padding: "6px 10px" }}>日</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>技術売上</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>店販売上</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>合計売上</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>客単価</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>来店数</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>新規</th>
                    <th style={{ textAlign: "right", padding: "6px 10px" }}>既存</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((d) => (
                    <tr key={d.day} style={{ borderBottom: `1px solid ${LINE}` }}>
                      <td style={{ padding: "6px 10px", fontWeight: 600 }}>{d.day}日</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: INK_SOFT }}>{yen(d.technicalSales)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: INK_SOFT }}>{yen(d.productSales)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>{yen(d.totalSales)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", color: INK_SOFT }}>{yen(d.avgSpend)}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>{d.totalCount}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>{d.newCount}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>{d.repeatCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* annual monthly table (年間モード) */}
          {period === "year" && yearMonthlyRows.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 18, marginBottom: 22, overflowX: "auto" }}>
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
                  {yearMonthlyRows.map((m) => (
                    <tr key={m.month} style={{ borderBottom: `1px solid ${LINE}` }}>
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
                  <tr style={{ borderTop: `2px solid ${INK}`, fontWeight: 700 }}>
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
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 18, marginBottom: 22, overflowX: "auto" }}>
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
                  {staffTable.map((s) => (
                    <tr key={s.staff} style={{ borderBottom: `1px solid ${LINE}` }}>
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
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 18, marginBottom: 22, overflowX: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>メニュー別 月次集計（{effectiveYear}年・技術売上）</div>
              <div style={{ fontSize: 11.5, color: INK_SOFT, marginBottom: 10 }}>年間タブで年を選ぶと、対象年が切り替わります。</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
                <thead>
                  <tr style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                    <th style={{ textAlign: "left", padding: "6px 10px" }}>メニュー</th>
                    {menuMonthlyTable.months.map((m) => (
                      <th key={m} style={{ textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap" }}>
                        {m.replace(/^\d+年/, "")}
                      </th>
                    ))}
                    <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700 }}>合計</th>
                  </tr>
                </thead>
                <tbody>
                  {menuMonthlyTable.table.map((row) => (
                    <tr key={row.menu} style={{ borderBottom: `1px solid ${LINE}` }}>
                      <td style={{ padding: "6px 10px", fontWeight: 600 }}>{row.menu}</td>
                      {menuMonthlyTable.months.map((m) => (
                        <td key={m} style={{ padding: "6px 8px", textAlign: "right", color: INK_SOFT }}>
                          {row[m] ? yen(row[m]) : "―"}
                        </td>
                      ))}
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{yen(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* product breakdown */}
          {productMonthlyTable.table.length > 0 && (
            <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 18, marginBottom: 22, overflowX: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>商品別 月次集計（{effectiveYear}年・店販売上）</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
                <thead>
                  <tr style={{ color: INK_SOFT, borderBottom: `1px solid ${LINE}` }}>
                    <th style={{ textAlign: "left", padding: "6px 10px" }}>商品名</th>
                    {productMonthlyTable.months.map((m) => (
                      <th key={m} style={{ textAlign: "right", padding: "6px 8px", whiteSpace: "nowrap" }}>
                        {m.replace(/^\d+年/, "")}
                      </th>
                    ))}
                    <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700 }}>合計</th>
                  </tr>
                </thead>
                <tbody>
                  {productMonthlyTable.table.map((row) => (
                    <tr key={row.product} style={{ borderBottom: `1px solid ${LINE}` }}>
                      <td style={{ padding: "6px 10px", fontWeight: 600 }}>{row.product}</td>
                      {productMonthlyTable.months.map((m) => (
                        <td key={m} style={{ padding: "6px 8px", textAlign: "right", color: INK_SOFT }}>
                          {row[m] ? yen(row[m]) : "―"}
                        </td>
                      ))}
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{yen(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
