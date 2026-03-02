import { useState, useMemo } from 'react'

export default function ComparisonView({ historyRows, adImages }) {
  const periods = useMemo(() => {
    const set = new Set(historyRows.map(r => r.period))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [historyRows])

  const [period1, setPeriod1] = useState(() => periods[0] || '')
  const [period2, setPeriod2] = useState(() => periods[1] || '')

  const rows1 = useMemo(() => historyRows.filter(r => r.period === period1), [historyRows, period1])
  const rows2 = useMemo(() => historyRows.filter(r => r.period === period2), [historyRows, period2])

  const campaigns = useMemo(() => {
    const map = new Map()
    ;[...rows1, ...rows2].forEach(row => {
      if (row.campaign_id && !map.has(row.campaign_id)) {
        map.set(row.campaign_id, row.campaign_name || row.campaign_id)
      }
    })
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [rows1, rows2])

  if (historyRows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📊</p>
        <p className="text-sm">まずデータを取得してください</p>
      </div>
    )
  }

  if (periods.length < 2) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📈</p>
        <p className="text-sm">比較するには2週間分以上のデータが必要です</p>
        <p className="text-xs mt-1">異なる期間でデータを取得してください</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 期間セレクター */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-600">比較期間:</span>
        <select
          value={period1}
          onChange={e => setPeriod1(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-gray-400 font-medium text-sm">vs</span>
        <select
          value={period2}
          onChange={e => setPeriod2(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-gray-400">※ 左が新しい週（基準）</span>
      </div>

      {/* キャンペーン別 */}
      {campaigns.map(({ id: campId, name: campName }) => {
        const adMap = new Map()
        ;[
          ...rows1.filter(r => r.campaign_id === campId),
          ...rows2.filter(r => r.campaign_id === campId),
        ].forEach(row => {
          if (!adMap.has(row.ad_id)) adMap.set(row.ad_id, row.ad_name)
        })
        const ads = [...adMap.entries()].map(([id, name]) => ({ id, name }))

        return (
          <section key={campId} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-gray-700 whitespace-nowrap">📁 {campName}</h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            {ads.map(({ id: adId, name: adName }) => {
              const r1 = rows1.find(r => r.campaign_id === campId && r.ad_id === adId)
              const r2 = rows2.find(r => r.campaign_id === campId && r.ad_id === adId)
              return (
                <AdCompareCard
                  key={adId}
                  adName={adName}
                  imageUrl={adImages[adId] || ''}
                  period1={period1}
                  period2={period2}
                  r1={r1}
                  r2={r2}
                />
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

function AdCompareCard({ adName, imageUrl, period1, period2, r1, r2 }) {
  const [showDemo, setShowDemo] = useState(false)

  const deltaCtr = r1 && r2 ? r1.ctr - r2.ctr : null
  const deltaCpc = r1 && r2 ? r1.cpc - r2.cpc : null
  const deltaSpend = r1 && r2 ? r1.spend - r2.spend : null

  const demo1 = r1?.demographics || []
  const demo2 = r2?.demographics || []
  const hasDemo = demo1.length > 0 || demo2.length > 0

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* 広告画像 */}
        <div className="w-20 shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt={adName} className="w-full rounded-lg block" />
          ) : (
            <div
              className="w-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-300"
              style={{ aspectRatio: '3/4' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* コンテンツ */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 mb-3 line-clamp-2" title={adName}>{adName}</p>

          {/* 指標比較テーブル */}
          <div className="grid grid-cols-4 gap-x-2 text-xs">
            {/* ヘッダー */}
            <div />
            <div className="text-center text-blue-600 font-medium truncate pb-1.5 border-b border-gray-100" title={period1}>{period1}</div>
            <div className="text-center text-gray-400 font-medium truncate pb-1.5 border-b border-gray-100" title={period2}>{period2}</div>
            <div className="text-center text-gray-500 font-medium pb-1.5 border-b border-gray-100">変化</div>

            {/* CTR */}
            <div className="text-gray-400 flex items-center py-1.5">CTR</div>
            <div className="text-center font-bold text-gray-800 py-1.5">{r1 ? `${r1.ctr.toFixed(2)}%` : '-'}</div>
            <div className="text-center text-gray-400 py-1.5">{r2 ? `${r2.ctr.toFixed(2)}%` : '-'}</div>
            <div className={`text-center font-bold py-1.5 ${
              deltaCtr === null ? 'text-gray-300'
              : deltaCtr > 0 ? 'text-green-600'
              : deltaCtr < 0 ? 'text-red-500'
              : 'text-gray-400'
            }`}>
              {deltaCtr === null ? '-' : `${deltaCtr > 0 ? '+' : ''}${deltaCtr.toFixed(2)}pt`}
            </div>

            {/* CPC */}
            <div className="text-gray-400 flex items-center py-1.5">CPC</div>
            <div className="text-center font-bold text-gray-800 py-1.5">{r1 ? `¥${Math.round(r1.cpc)}` : '-'}</div>
            <div className="text-center text-gray-400 py-1.5">{r2 ? `¥${Math.round(r2.cpc)}` : '-'}</div>
            <div className={`text-center font-bold py-1.5 ${
              deltaCpc === null ? 'text-gray-300'
              : deltaCpc < 0 ? 'text-green-600'
              : deltaCpc > 0 ? 'text-red-500'
              : 'text-gray-400'
            }`}>
              {deltaCpc === null ? '-' : `${deltaCpc > 0 ? '+' : '-'}¥${Math.abs(Math.round(deltaCpc))}`}
            </div>

            {/* 消化 */}
            <div className="text-gray-400 flex items-center py-1.5">消化</div>
            <div className="text-center font-bold text-gray-800 py-1.5">{r1 ? `¥${Math.round(r1.spend).toLocaleString()}` : '-'}</div>
            <div className="text-center text-gray-400 py-1.5">{r2 ? `¥${Math.round(r2.spend).toLocaleString()}` : '-'}</div>
            <div className="text-center font-bold text-gray-600 py-1.5">
              {deltaSpend === null ? '-' : `${deltaSpend > 0 ? '+' : '-'}¥${Math.abs(Math.round(deltaSpend)).toLocaleString()}`}
            </div>
          </div>
        </div>
      </div>

      {/* デモグラフィック（折りたたみ） */}
      {hasDemo && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowDemo(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <span>👥 年齢・性別比較</span>
            <span>{showDemo ? '▲' : '▼'}</span>
          </button>
          {showDemo && (
            <div className="px-4 pb-4">
              <DemoCompare demo1={demo1} demo2={demo2} period1={period1} period2={period2} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DemoCompare({ demo1, demo2, period1, period2 }) {
  const calcStats = (demos) => {
    const total = demos.reduce((s, d) => s + d.impressions, 0)
    const maleImp = demos.filter(d => d.gender === 'male').reduce((s, d) => s + d.impressions, 0)
    const maleP = total > 0 ? Math.round(maleImp / total * 100) : 0
    const ageMap = {}
    demos.forEach(d => { ageMap[d.age] = (ageMap[d.age] || 0) + d.impressions })
    const ages = Object.entries(ageMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([age, imp]) => ({ age, percent: total > 0 ? Math.round(imp / total * 100) : 0 }))
    return { maleP, femaleP: 100 - maleP, ages }
  }

  const s1 = demo1.length > 0 ? calcStats(demo1) : null
  const s2 = demo2.length > 0 ? calcStats(demo2) : null
  const allAges = [...new Set([
    ...(s1?.ages.map(a => a.age) || []),
    ...(s2?.ages.map(a => a.age) || []),
  ])].sort()

  return (
    <div className="space-y-3">
      {/* 性別バー */}
      <div className="space-y-2">
        {s1 && (
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-blue-600 font-medium">{period1}</span>
              <span className="text-gray-400">男 {s1.maleP}% / 女 {s1.femaleP}%</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden">
              <div className="bg-blue-400" style={{ width: `${s1.maleP}%` }} />
              <div className="bg-pink-400" style={{ width: `${s1.femaleP}%` }} />
            </div>
          </div>
        )}
        {s2 && (
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-400">{period2}</span>
              <span className="text-gray-300">男 {s2.maleP}% / 女 {s2.femaleP}%</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden">
              <div className="bg-blue-200" style={{ width: `${s2.maleP}%` }} />
              <div className="bg-pink-200" style={{ width: `${s2.femaleP}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* 年齢バー（2期間を並べて表示） */}
      <div className="space-y-2">
        {allAges.map(age => {
          const a1 = s1?.ages.find(a => a.age === age)
          const a2 = s2?.ages.find(a => a.age === age)
          return (
            <div key={age} className="flex items-start gap-2">
              <span className="text-xs text-gray-400 w-14 shrink-0 mt-0.5">{age}</span>
              <div className="flex-1 space-y-0.5">
                {a1 && (
                  <div className="flex items-center gap-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${a1.percent}%` }} />
                    </div>
                    <span className="text-xs text-blue-600 w-8 text-right shrink-0">{a1.percent}%</span>
                  </div>
                )}
                {a2 && (
                  <div className="flex items-center gap-1">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-indigo-200 h-1.5 rounded-full" style={{ width: `${a2.percent}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right shrink-0">{a2.percent}%</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 凡例 */}
      <div className="flex gap-4 text-xs pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 bg-indigo-400 rounded-sm" />
          <span className="text-blue-600">{period1}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 bg-indigo-200 rounded-sm" />
          <span className="text-gray-400">{period2}</span>
        </div>
      </div>
    </div>
  )
}
