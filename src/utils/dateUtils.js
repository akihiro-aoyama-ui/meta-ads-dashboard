/**
 * 日付ユーティリティ
 */

/**
 * 先週の月曜〜日曜の日付範囲を返す
 * @returns {{ since: string, until: string }} YYYY-MM-DD形式
 */
export function getLastWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=日, 1=月, ..., 6=土

  // 今週の月曜日
  const thisMon = new Date(now);
  thisMon.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  thisMon.setHours(0, 0, 0, 0);

  // 先週月曜日
  const lastMon = new Date(thisMon);
  lastMon.setDate(thisMon.getDate() - 7);

  // 先週日曜日
  const lastSun = new Date(lastMon);
  lastSun.setDate(lastMon.getDate() + 6);

  return {
    since: formatDate(lastMon),
    until: formatDate(lastSun),
  };
}

/**
 * Date を YYYY-MM-DD 形式の文字列に変換する
 */
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * YYYY-MM-DD を MM/DD に変換する
 */
export function toShortDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.slice(5).replace('-', '/');
}
