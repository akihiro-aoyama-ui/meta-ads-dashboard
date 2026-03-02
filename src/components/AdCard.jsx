import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { getPerformanceLevel, getPerformanceBadgeClass, getAdInsights } from '../utils/performance'

export default function AdCard({ ad, imageUrl, onImageUpload }) {
  const fileInputRef = useRef(null)
  const cardRef = useRef(null)
  const [showDemo, setShowDemo] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const level = getPerformanceLevel(ad.ctr, ad.cpc)
  const badgeClass = getPerformanceBadgeClass(level)
  const { good, more } = getAdInsights(ad.ctr, ad.cpc, ad.spend)

  // デモグラフィック集計
  const demographics = ad.demographics || []
  const demoAvailable = demographics.length > 0

  const totalImp = demographics.reduce((s, d) => s + d.impressions, 0)
  const maleImp = demographics.filter(d => d.gender === 'male').reduce((s, d) => s + d.impressions, 0)
  const femaleImp = demographics.filter(d => d.gender === 'female').reduce((s, d) => s + d.impressions, 0)
  const malePercent = totalImp > 0 ? Math.round(maleImp / totalImp * 100) : 0
  const femalePercent = 100 - malePercent

  // 年齢層集計（impressions合計）
  const ageMap = {}
  demographics.forEach(d => {
    ageMap[d.age] = (ageMap[d.age] || 0) + d.impressions
  })
  const ageGroups = Object.entries(ageMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([age, imp]) => ({ age, percent: totalImp > 0 ? Math.round(imp / totalImp * 100) : 0 }))

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { onImageUpload(ad.ad_id, ev.target.result) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleScreenshot() {
    if (!cardRef.current) return
    setCapturing(true)
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true })
      const link = document.createElement('a')
      link.download = `${ad.ad_name || 'ad'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div ref={cardRef} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      {/* サムネイルエリア */}
      <div className="relative bg-gray-100">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt={ad.ad_name} className="w-full block" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded-lg hover:bg-black/70 transition-colors"
            >変更</button>
          </>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center w-full gap-2 text-gray-400 hover:bg-gray-200 transition-colors group"
            style={{ aspectRatio: '3/4' }}
          >
            <svg className="w-10 h-10 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs group-hover:text-gray-600">クリックで画像をアップロード</span>
          </button>
        )}
        <span className={`absolute top-2 right-2 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${badgeClass}`}>
          {level}
        </span>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* 広告情報 */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        {ad.campaign_name && (
          <div className="text-xs text-gray-400 truncate" title={`${ad.campaign_name} › ${ad.adset_name}`}>
            {ad.campaign_name}{ad.adset_name && <span> › {ad.adset_name}</span>}
          </div>
        )}
        <h3 className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2" title={ad.ad_name}>
          {ad.ad_name}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="CTR" value={`${ad.ctr.toFixed(2)}%`} highlight={ad.ctr >= 3.0} warn={ad.ctr < 1.5} />
          <Metric label="CPC" value={`¥${Math.round(ad.cpc).toLocaleString()}`} highlight={ad.cpc > 0 && ad.cpc <= 20} warn={ad.cpc > 100} />
          <Metric label="消化" value={`¥${Math.round(ad.spend).toLocaleString()}`} />
        </div>

        {good.length > 0 && (
          <div className="bg-green-50 rounded-lg px-3 py-2">
            <p className="text-xs font-bold text-green-700 mb-1">✓ 良い点</p>
            {good.map((g, i) => <p key={i} className="text-xs text-green-700 leading-relaxed">{g}</p>)}
          </div>
        )}
        {more.length > 0 && (
          <div className="bg-amber-50 rounded-lg px-3 py-2">
            <p className="text-xs font-bold text-amber-700 mb-1">→ 改善案</p>
            {more.map((m, i) => <p key={i} className="text-xs text-amber-700 leading-relaxed">{m}</p>)}
          </div>
        )}

        {/* デモグラフィック折りたたみ */}
        {demoAvailable && (
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDemo(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <span>👥 年齢・性別</span>
              <span>{showDemo ? '▲' : '▼'}</span>
            </button>
            {showDemo && (
              <div className="px-3 pb-3 space-y-3">
                {/* 性別バー */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>男性 {malePercent}%</span>
                    <span>女性 {femalePercent}%</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div className="bg-blue-400" style={{ width: `${malePercent}%` }} />
                    <div className="bg-pink-400" style={{ width: `${femalePercent}%` }} />
                  </div>
                </div>
                {/* 年齢バー */}
                <div className="space-y-1">
                  {ageGroups.map(({ age, percent }) => (
                    <div key={age} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-14 shrink-0">{age}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="bg-indigo-400 h-2 rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{percent}%</span>
                    </div>
                  ))}
                </div>
                {/* スクリーンショットボタン */}
                <button
                  onClick={handleScreenshot}
                  disabled={capturing}
                  className="w-full text-xs py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors disabled:opacity-50"
                >
                  {capturing ? '保存中...' : '📷 画像として保存'}
                </button>
              </div>
            )}
          </div>
        )}

        {ad.period && (
          <p className="text-xs text-gray-400 text-center">{ad.period}</p>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, highlight, warn }) {
  const color = highlight ? 'text-green-600' : warn ? 'text-red-500' : 'text-gray-800'
  return (
    <div className="text-center bg-gray-50 rounded-lg py-2">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  )
}
