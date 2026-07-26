import { fetchVisits } from "./karteFirebase";

// カルテアプリ側の表記ゆれ（例：「難波純一郎」→正しくは「難波順一朗」）を吸収する名寄せ
const STAFF_NAME_ALIASES = {
  難波純一郎: "難波順一朗",
};
function normalizeStaffName(name) {
  return STAFF_NAME_ALIASES[name] || name;
}

// "2026-08-05" -> "2026年8月"
function monthLabelOf(dateStr) {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}年${Number(m[2])}月`;
}

// 来店1件の金額を「技術売上」「店販売上」に分解する（カルテアプリと同じロジック）
function splitVisitAmounts(v) {
  const total = Number(v.price) || 0;
  const buppan = (v.purchasedProducts || []).reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.qty) || 1), 0);
  const shisen = total - buppan;
  return { shisen, buppan };
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

/**
 * カルテの来店記録(visits)から、ダッシュボードのstaffRowsと同じ形
 * （店舗・スタッフ・月ごとの、新規/リピート件数・次回予約件数・技術売上・店販売上）の行を作る。
 */
export function buildStaffRowsFromVisits(rawVisits) {
  const visits = attachIsNew(rawVisits.map((v) => ({ ...v, staff: normalizeStaffName(v.staff) })));
  const byKey = new Map();
  visits.forEach((v) => {
    const month = monthLabelOf(v.date);
    if (!month || !v.store || !v.staff) return;
    const key = `${v.store}||${v.staff}||${month}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: `karte-${key}`,
        store: v.store,
        name: v.staff,
        month,
        newC: 0,
        newBookings: 0,
        repeatC: 0,
        repeatBookings: 0,
        sales: 0,
        productSales: 0,
        fromKarte: true,
      });
    }
    const row = byKey.get(key);
    const { shisen, buppan } = splitVisitAmounts(v);
    row.sales += shisen;
    row.productSales += buppan;
    if (v.__isNew === true) {
      row.newC += 1;
      if (v.nextBooked) row.newBookings += 1;
    } else if (v.__isNew === false) {
      row.repeatC += 1;
      if (v.nextBooked) row.repeatBookings += 1;
    }
  });
  return Array.from(byKey.values());
}

/** sinceDate（例："2026-08-01"）以降のカルテ来店記録を取得し、staffRows形式にして返す */
export async function fetchKarteStaffRows(sinceDate) {
  const rows = await fetchVisits(sinceDate);
  return buildStaffRowsFromVisits(rows);
}
