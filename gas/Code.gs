/**
 * Meta広告 パフォーマンス自動収集スクリプト
 *
 * 【初回セットアップ】
 * 1. setInitialProperties() を手動実行して認証情報を登録
 * 2. setupWeeklyTrigger() を手動実行して月曜トリガーを登録
 * 3. このスクリプトをWebアプリとしてデプロイ
 *    - 「次のユーザーとして実行」: 自分
 *    - 「アクセスできるユーザー」: 全員（匿名ユーザーを含む）
 */

// ============================================================
// 初期設定（初回のみ手動実行）
// ============================================================

function setInitialProperties() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    META_ACCESS_TOKEN: props.getProperty('META_ACCESS_TOKEN') || 'YOUR_META_ACCESS_TOKEN',
    AD_ACCOUNT_ID: props.getProperty('AD_ACCOUNT_ID') || 'act_XXXXXXXXXX',
    SPREADSHEET_ID: '1lX8HXCeApYeOAbWABa_Ebj290asP5_VNL-Ks4OAaP74',
  });
  Logger.log('設定を保存しました（SPREADSHEET_ID更新済み）');
}

// ============================================================
// Webアプリエントリーポイント
// ============================================================

/**
 * GET リクエストのエントリーポイント（JSONP対応）
 *
 * action='fetch'   : Meta APIからデータ取得 → 新規期間のみシートに保存
 * action='getData' : シートから全履歴を返す
 */
function doGet(e) {
  const params = e.parameter || {};
  const callback = params.callback;
  const action = params.action || 'fetch';

  let result;
  try {
    if (action === 'getData') {
      result = getSheetHistory();
    } else {
      const token = params.token || PropertiesService.getScriptProperties().getProperty('META_ACCESS_TOKEN');
      const accountId = params.accountId || PropertiesService.getScriptProperties().getProperty('AD_ACCOUNT_ID');
      // カスタム期間が指定されていればそれを使う
      const customSince = params.since || null;
      const customUntil = params.until || null;
      result = fetchAndSave(token, accountId, customSince, customUntil);
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  const json = JSON.stringify(result);

  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// メイン処理
// ============================================================

/**
 * Meta APIからデータを取得し、新規期間のみシートの先頭に追加する
 * customSince/customUntil が指定された場合はその期間のみ取得
 * 未指定の場合は先週＋2週間前を取得
 */
function fetchAndSave(token, accountId, customSince, customUntil) {
  if (customSince && customUntil) {
    // ── カスタム期間モード ──
    const range = { since: customSince, until: customUntil };
    const period = `${range.since.slice(5)}〜${range.until.slice(5)}`;
    const ads = fetchMetaAdsData(token, accountId, range);

    if (ads.length === 0) {
      return { success: true, count: 0, ads: [], message: '対象広告なし' };
    }
    if (!isPeriodAlreadySaved(period)) {
      saveToSheetTop(ads, range);
    }

    // デモグラフィック取得
    const adIds = ads.map(a => a.ad_id);
    const demographics = fetchDemographics(token, accountId, adIds, range);
    ads.forEach(ad => { ad.demographics = demographics[ad.ad_id] || []; });

    return {
      success: true,
      count: ads.length,
      ads: ads,
      dateRange: `${customSince}〜${customUntil}`,
      allWeeksAds: ads.map(ad => ({ ...ad, fetchedAt: range.since, period })),
    };
  }

  // ── デフォルト：先週＋2週間前モード ──
  const range1 = getWeekRange(1);
  const range2 = getWeekRange(2);
  const period1 = `${range1.since.slice(5)}〜${range1.until.slice(5)}`;
  const period2 = `${range2.since.slice(5)}〜${range2.until.slice(5)}`;

  const ads1 = fetchMetaAdsData(token, accountId, range1);
  const ads2 = fetchMetaAdsData(token, accountId, range2);

  if (ads1.length === 0 && ads2.length === 0) {
    return { success: true, count: 0, ads: [], message: '対象広告なし' };
  }

  // 古い週から先に挿入することで最終的に新しい週が上に来る
  if (ads2.length > 0 && !isPeriodAlreadySaved(period2)) saveToSheetTop(ads2, range2);
  if (ads1.length > 0 && !isPeriodAlreadySaved(period1)) saveToSheetTop(ads1, range1);

  // 両週にデモグラフィックを付与
  if (ads1.length > 0) {
    const adIds1 = ads1.map(a => a.ad_id);
    const demo1 = fetchDemographics(token, accountId, adIds1, range1);
    ads1.forEach(ad => { ad.demographics = demo1[ad.ad_id] || []; });
  }
  if (ads2.length > 0) {
    const adIds2 = ads2.map(a => a.ad_id);
    const demo2 = fetchDemographics(token, accountId, adIds2, range2);
    ads2.forEach(ad => { ad.demographics = demo2[ad.ad_id] || []; });
  }

  const allWeeksAds = [
    ...ads1.map(ad => ({ ...ad, fetchedAt: range1.since, period: period1 })),
    ...ads2.map(ad => ({ ...ad, fetchedAt: range2.since, period: period2 })),
  ];

  return {
    success: true,
    count: ads1.length,
    ads: ads1,
    dateRange: `${range1.since}〜${range1.until}`,
    allWeeksAds: allWeeksAds,
  };
}

/**
 * GASトリガーから毎週月曜日に自動実行される関数
 */
function weeklyAutoFetch() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const result = fetchAndSave(props.META_ACCESS_TOKEN, props.AD_ACCOUNT_ID);
  Logger.log(`自動取得完了: 先週${result.count}件`);
}

// ============================================================
// Meta API呼び出し
// ============================================================

function fetchMetaAdsData(token, accountId, dateRange) {
  const insightFields = [
    'ad_name', 'ad_id',
    'campaign_id', 'campaign_name',
    'adset_id', 'adset_name',
    'unique_inline_link_click_ctr',
    'cost_per_unique_inline_link_click',
    'spend',
  ].join(',');

  // date_preset(last_week_mon_sun) は常に「先週」固定になるため、
  // 指定期間のデータを正確に取得するには insights.time_range を使う
  const insightsTimeRange = `{"since":"${dateRange.since}","until":"${dateRange.until}"}`;
  const params = {
    fields: `id,name,effective_status,campaign{id,name},adset{id,name},insights.time_range(${insightsTimeRange}){${insightFields}}`,
    effective_status: '["ACTIVE"]',
    time_range: `{"since":"${dateRange.since}","until":"${dateRange.until}"}`,
    access_token: token,
  };
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `https://graph.facebook.com/v21.0/${accountId}/ads?${qs}`;

  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(response.getContentText());
  if (json.error) throw new Error(`Meta API エラー: ${json.error.message}`);

  const ads = [];
  (json.data || []).forEach(ad => {
    const insights = ad.insights && ad.insights.data && ad.insights.data[0];
    if (!insights) return;
    ads.push({
      ad_id: ad.id,
      ad_name: ad.name,
      campaign_id: (ad.campaign && ad.campaign.id) || '',
      campaign_name: (ad.campaign && ad.campaign.name) || '',
      adset_id: (ad.adset && ad.adset.id) || '',
      adset_name: (ad.adset && ad.adset.name) || '',
      ctr: parseFloat(insights.unique_inline_link_click_ctr || 0),
      cpc: parseFloat(insights.cost_per_unique_inline_link_click || 0),
      spend: parseFloat(insights.spend || 0),
    });
  });
  return ads;
}

/**
 * 広告IDリストの男女・年齢層別インプレッション数を取得する
 * @returns {Object} { ad_id: [{age, gender, impressions}] }
 */
function fetchDemographics(token, accountId, adIds, dateRange) {
  if (!adIds || adIds.length === 0) return {};

  const filtering = JSON.stringify([{ field: 'ad.id', operator: 'IN', value: adIds }]);
  const params = {
    level: 'ad',
    fields: 'ad_id,impressions',
    breakdowns: 'age,gender',
    time_range: JSON.stringify({ since: dateRange.since, until: dateRange.until }),
    filtering: filtering,
    limit: '500',
    access_token: token,
  };
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `https://graph.facebook.com/v21.0/${accountId}/insights?${qs}`;

  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(response.getContentText());
  if (json.error) {
    Logger.log('Demographics エラー: ' + json.error.message);
    return {};
  }

  const result = {};
  (json.data || []).forEach(row => {
    if (!result[row.ad_id]) result[row.ad_id] = [];
    result[row.ad_id].push({
      age: row.age,
      gender: row.gender,
      impressions: parseInt(row.impressions || 0),
    });
  });
  return result;
}

// ============================================================
// スプレッドシート操作
// ============================================================

function getSheet() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty('SPREADSHEET_ID');

  // IDが未設定またはスプレッドシートが存在しない場合は自動作成
  let ss;
  if (!spreadsheetId) {
    ss = SpreadsheetApp.create('Meta広告パフォーマンスデータ');
    spreadsheetId = ss.getId();
    props.setProperty('SPREADSHEET_ID', spreadsheetId);
    Logger.log('スプレッドシートを自動作成しました: ' + ss.getUrl());
  } else {
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      // 保存済みIDで開けない場合（削除等）は再作成
      ss = SpreadsheetApp.create('Meta広告パフォーマンスデータ');
      spreadsheetId = ss.getId();
      props.setProperty('SPREADSHEET_ID', spreadsheetId);
      Logger.log('スプレッドシートを再作成しました: ' + ss.getUrl());
    }
  }

  let sheet = ss.getSheetByName('広告データ');
  if (!sheet) {
    sheet = ss.insertSheet('広告データ');
    sheet.appendRow(['取得日', '期間', 'キャンペーン名', '広告セット名', '広告名', 'ユニークCTR(%)', 'ユニークCPC(円)', '消化金額(円)']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * この期間のデータが既にシートに存在するか確認する
 */
function isPeriodAlreadySaved(period) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  // B列（期間）だけを取得して検索
  const periods = sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat();
  return periods.includes(period);
}

/**
 * 新しいデータをシートの先頭（ヘッダー直下）に挿入する
 * 最新データが上に来るよう先頭に追加する
 */
function saveToSheetTop(ads, dateRange) {
  const sheet = getSheet();
  const now = new Date();
  const period = `${dateRange.since.slice(5)}〜${dateRange.until.slice(5)}`;

  const rows = ads.map(ad => [
    now,
    period,
    ad.campaign_name,
    ad.adset_name,
    ad.ad_name,
    ad.ctr,
    ad.cpc,
    ad.spend,
  ]);

  // ヘッダー行（1行目）の直下にrows.length行を挿入してからデータをセット
  sheet.insertRowsBefore(2, rows.length);
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * シートから全履歴データを返す（新しい順）
 */
function getSheetHistory() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, rows: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  const rows = values
    .filter(row => row[1]) // 期間列が空の行をスキップ
    .map(row => ({
      fetchedAt: row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm') : '',
      period: row[1],
      campaign_name: row[2],
      adset_name: row[3],
      ad_name: row[4],
      ctr: parseFloat(row[5]) || 0,
      cpc: parseFloat(row[6]) || 0,
      spend: parseFloat(row[7]) || 0,
    }));

  return { success: true, rows };
}

// ============================================================
// トリガー管理
// ============================================================

function setupWeeklyTrigger() {
  deleteOldTriggers('weeklyAutoFetch');
  ScriptApp.newTrigger('weeklyAutoFetch')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
  Logger.log('毎週月曜 9:00 のトリガーを設定しました');
}

function deleteOldTriggers(functionName) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === functionName)
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * 指定した週前の月曜〜日曜を返す
 * @param {number} weeksAgo - 1=先週, 2=2週間前
 */
function getWeekRange(weeksAgo) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const thisMon = new Date(now);
  thisMon.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  thisMon.setHours(0, 0, 0, 0);
  const targetMon = new Date(thisMon);
  targetMon.setDate(thisMon.getDate() - 7 * weeksAgo);
  const targetSun = new Date(targetMon);
  targetSun.setDate(targetMon.getDate() + 6);
  return { since: formatDate(targetMon), until: formatDate(targetSun) };
}

// 後方互換のため残す
function getLastWeekRange() {
  return getWeekRange(1);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
