import { useState, useCallback, useMemo, useEffect } from 'react'
import AdCard from './AdCard'
import AISummary from './AISummary'
import ComparisonView from './ComparisonView'
import { jsonpFetch } from '../utils/jsonp'
import { getLastWeekRange, toShortDate } from '../utils/dateUtils'
import { PERFORMANCE_LEVELS, getPerformanceLevel } from '../utils/performance'

const STORAGE_KEY_IMAGES = 'meta_ads_images'
const STORAGE_KEY_HISTORY = 'meta_ads_history'

/**
 * メインダッシュボード
 */
export default function Dashboard({ settings, onOpenSettings }) {
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastFetched, setLastFetched] = useState('')
  const [filter, setFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [view, setView] = useState('cards') // 'cards' | 'comparison'

  // 日付選択（デフォルト：先週の月〜日）
  const defaultRange = getLastWeekRange()
  const [sinceDate, setSinceDate] = useState(defaultRange.since)
  const [untilDate, setUntilDate] = useState(defaultRange.until)

  // 広告画像マップ: { [adId]: base64DataUrl } - localStorage永続
  const [adImages, setAdImages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_IMAGES) || '{}')
    } catch { return {} }
  })

  // 過去履歴（トレンド用）: 行配列 - localStorage永続
  const [historyRows, setHistoryRows] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]')
    } catch { return [] }
  })

  // 画像マップが変わったらlocalStorageに保存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_IMAGES, JSON.stringify(adImages))
    } catch { /* localStorage容量超過時は無視 */ }
  }, [adImages])

  // 履歴が変わったらlocalStorageに保存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyRows))
    } catch { /* localStorage容量超過時は無視 */ }
  }, [historyRows])

  const isConfigured = settings.gasUrl && settings.metaToken && settings.adAccountId

  // GASからデータを取得
  const handleFetch = useCallback(async () => {
    if (!isConfigured) {
      setError('設定を完了してください（GAS URL / Meta Token / Account ID）')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await jsonpFetch(settings.gasUrl, {
        action: 'fetch',
        token: settings.metaToken,
        accountId: settings.adAccountId,
        since: sinceDate,
        until: untilDate,
      })

      if (!result.success) {
        throw new Error(result.error || 'データ取得に失敗しました')
      }

      const fetchedAds = result.ads || []
      setAds(fetchedAds)
      setLastFetched(result.dateRange || '')

      // 両週のデータをlocalStorage履歴に反映（period単位で重複排除）
      // period形式を "MM-DD〜MM-DD" に統一（"2026-02-09〜2026-02-15" → "02-09〜02-15"）
      const normalizePeriod = (p) =>
        (p || '').replace(/^\d{4}-(\d{2}-\d{2})〜\d{4}-(\d{2}-\d{2})$/, '$1〜$2')

      const rawAds = result.allWeeksAds || fetchedAds.map(ad => ({
        ...ad,
        fetchedAt: new Date().toISOString().slice(0, 10),
        period: result.dateRange || '',
      }))
      const allWeeksAds = rawAds.map(ad => ({ ...ad, period: normalizePeriod(ad.period) }))

      if (allWeeksAds.length > 0) {
        const incomingPeriods = [...new Set(allWeeksAds.map(r => r.period))]
        setHistoryRows(prev => {
          // 既存データのperiodも正規化してから重複除去
          const normalizedPrev = prev.map(r => ({ ...r, period: normalizePeriod(r.period) }))
          const filtered = normalizedPrev.filter(r => !incomingPeriods.includes(r.period))
          return [...filtered, ...allWeeksAds]
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [settings, isConfigured, sinceDate, untilDate])

  // 画像アップロードハンドラ
  const handleImageUpload = useCallback((adId, dataUrl) => {
    setAdImages(prev => ({ ...prev, [adId]: dataUrl }))
  }, [])

  // キャンペーン一覧（重複除去）
  const campaigns = useMemo(() => {
    const map = new Map()
    ads.forEach(ad => {
      if (ad.campaign_id && !map.has(ad.campaign_id)) {
        map.set(ad.campaign_id, ad.campaign_name || ad.campaign_id)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [ads])

  // フィルター適用
  const filteredAds = ads.filter(ad => {
    if (campaignFilter !== 'all' && ad.campaign_id !== campaignFilter) return false
    if (filter === 'all') return true
    return getPerformanceLevel(ad.ctr, ad.cpc) === filter
  })

  // サマリー集計
  const summary = {
    total: ads.length,
    excellent: ads.filter(a => getPerformanceLevel(a.ctr, a.cpc) === PERFORMANCE_LEVELS.EXCELLENT).length,
    good: ads.filter(a => getPerformanceLevel(a.ctr, a.cpc) === PERFORMANCE_LEVELS.GOOD).length,
    review: ads.filter(a => getPerformanceLevel(a.ctr, a.cpc) === PERFORMANCE_LEVELS.REVIEW).length,
    avgCtr: ads.length ? (ads.reduce((s, a) => s + a.ctr, 0) / ads.length).toFixed(2) : '-',
    avgCpc: ads.length ? Math.round(ads.reduce((s, a) => s + a.cpc, 0) / ads.length) : '-',
    totalSpend: ads.reduce((s, a) => s + a.spend, 0),
  }

  const { since, until } = getLastWeekRange()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Meta広告 パフォーマンスダッシュボード</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              対象期間: {toShortDate(since)} 〜 {toShortDate(until)}（先週）
              {lastFetched && ` | 表示中: ${lastFetched}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settings.spreadsheetUrl && (
              <a
                href={settings.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-4 py-2 border border-green-300 rounded-lg hover:bg-green-50 text-green-700 transition-colors"
              >
                スプレッドシートを開く
              </a>
            )}
            <button
              onClick={onOpenSettings}
              className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            >
              ⚙ 設定
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* アクションボタン＋日付選択 */}
        <div className="flex flex-wrap gap-3 items-center bg-white border border-gray-200 rounded-xl px-4 py-3">
          {/* 日付選択 */}
          <div className="flex items-center gap-2 text-sm">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">期間</label>
            <input
              type="date"
              value={sinceDate}
              onChange={e => setSinceDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-xs">〜</span>
            <input
              type="date"
              value={untilDate}
              onChange={e => setUntilDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleFetch}
            disabled={loading || !isConfigured || !sinceDate || !untilDate}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? '取得中...' : '▶ データ取得'}
          </button>
          {!isConfigured && (
            <p className="text-xs text-amber-600">設定が未完了です。⚙ 設定ボタンから入力してください</p>
          )}
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* サマリーカード */}
        {ads.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <SummaryCard label="合計広告数" value={summary.total} unit="本" />
            <SummaryCard label="優秀" value={summary.excellent} unit="本" color="green" />
            <SummaryCard label="良好" value={summary.good} unit="本" color="blue" />
            <SummaryCard label="要改善" value={summary.review} unit="本" color="yellow" />
            <SummaryCard label="平均CTR" value={summary.avgCtr} unit="%" />
            <SummaryCard label="平均CPC" value={summary.avgCpc !== '-' ? `¥${summary.avgCpc}` : '-'} />
            <SummaryCard label="総消化金額" value={`¥${Math.round(summary.totalSpend).toLocaleString()}`} />
          </div>
        )}

{/* AI サマリー */}
        {ads.length > 0 && (
          <AISummary ads={ads} geminiApiKey={settings.geminiApiKey} />
        )}

        {/* ビュー切り替えタブ */}
        {(ads.length > 0 || historyRows.length > 0) && (
          <div className="flex gap-2">
            <button
              onClick={() => setView('cards')}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                view === 'cards'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              カード表示
            </button>
            <button
              onClick={() => setView('comparison')}
              className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                view === 'comparison'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              週次比較
            </button>
          </div>
        )}

        {/* 週次比較ビュー */}
        {view === 'comparison' ? (
          <ComparisonView historyRows={historyRows} adImages={adImages} />
        ) : (
          <>
            {/* フィルター */}
            {ads.length > 0 && (
              <div className="space-y-2">
                {/* キャンペーンフィルター */}
                {campaigns.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-gray-500 font-medium">キャンペーン:</span>
                    {[{ id: 'all', name: `すべて` }, ...campaigns].map(({ id, name }) => (
                      <button
                        key={id}
                        onClick={() => setCampaignFilter(id)}
                        className={`text-xs px-3 py-1.5 rounded-full transition-colors font-medium ${
                          campaignFilter === id
                            ? 'bg-gray-800 text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                {/* パフォーマンスフィルター */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-500 font-medium">パフォーマンス:</span>
                  {[
                    { value: 'all', label: `すべて (${summary.total})` },
                    { value: PERFORMANCE_LEVELS.EXCELLENT, label: `優秀 (${summary.excellent})` },
                    { value: PERFORMANCE_LEVELS.GOOD, label: `良好 (${summary.good})` },
                    { value: PERFORMANCE_LEVELS.REVIEW, label: `要改善 (${summary.review})` },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      className={`text-xs px-3 py-1.5 rounded-full transition-colors font-medium ${
                        filter === value
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 広告カード */}
            {filteredAds.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredAds.map((ad, i) => (
                  <AdCard
                    key={ad.ad_id || i}
                    ad={ad}
                    imageUrl={adImages[ad.ad_id] || ''}
                    onImageUpload={handleImageUpload}
                  />
                ))}
              </div>
            ) : ads.length === 0 && !loading ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-sm">「データ取得を実行」ボタンで広告データを取得してください</p>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}

function SummaryCard({ label, value, unit, color }) {
  const colorClass = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    yellow: 'text-yellow-600',
  }[color] || 'text-gray-800'

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-3 py-3 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${colorClass}`}>
        {value}{unit && <span className="text-sm font-normal ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}
