import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'

/**
 * 過去4週間のCTR・CPCトレンドチャート
 *
 * @param {Array} rows - スプレッドシートの全履歴行
 */
export default function TrendChart({ rows }) {
  if (!rows || rows.length === 0) return null

  // 週別（period）に集計
  const weekMap = new Map()
  rows.forEach(row => {
    const key = row.period || row.fetchedAt?.slice(0, 7)
    if (!key) return
    if (!weekMap.has(key)) {
      weekMap.set(key, { period: key, ctrSum: 0, cpcSum: 0, spendSum: 0, count: 0 })
    }
    const w = weekMap.get(key)
    w.ctrSum  += row.ctr  || 0
    w.cpcSum  += row.cpc  || 0
    w.spendSum += row.spend || 0
    w.count++
  })

  // 直近4週分を古い順に並べる
  const data = Array.from(weekMap.values())
    .slice(-4)
    .map(w => ({
      period: w.period,
      avgCtr: parseFloat((w.ctrSum / w.count).toFixed(2)),
      avgCpc: Math.round(w.cpcSum / w.count),
      totalSpend: Math.round(w.spendSum),
    }))

  if (data.length < 2) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center text-sm text-gray-400">
        トレンドグラフは2週分以上のデータが必要です（現在 {data.length} 週分）
      </div>
    )
  }

  // CTR の前週差分を計算してラベル表示用に添付
  const dataWithDelta = data.map((d, i) => ({
    ...d,
    ctrDelta: i > 0 ? parseFloat((d.avgCtr - data[i - 1].avgCtr).toFixed(2)) : null,
    cpcDelta: i > 0 ? Math.round(d.avgCpc - data[i - 1].avgCpc) : null,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">週次トレンド（直近4週）</h2>
        {/* 直近の前週比バッジ */}
        {dataWithDelta.length >= 2 && (() => {
          const last = dataWithDelta[dataWithDelta.length - 1]
          return (
            <div className="flex gap-3">
              <Delta label="CTR" delta={last.ctrDelta} unit="%" higher />
              <Delta label="CPC" delta={last.cpcDelta} unit="円" higher={false} />
            </div>
          )
        })()}
      </div>

      {/* CTRグラフ */}
      <div>
        <p className="text-xs text-gray-500 font-medium mb-2">平均 CTR（%）</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={dataWithDelta} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" domain={['auto', 'auto']} />
            <Tooltip
              formatter={(v, n) => [`${v}%`, '平均CTR']}
              contentStyle={{ fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="avgCtr"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 5, fill: '#3b82f6' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CPCグラフ */}
      <div>
        <p className="text-xs text-gray-500 font-medium mb-2">平均 CPC（円）</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={dataWithDelta} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="円" domain={['auto', 'auto']} />
            <Tooltip
              formatter={(v, n) => [`¥${v}`, '平均CPC']}
              contentStyle={{ fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="avgCpc"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 5, fill: '#f59e0b' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 消化金額グラフ */}
      <div>
        <p className="text-xs text-gray-500 font-medium mb-2">週次 総消化金額（円）</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={dataWithDelta} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `¥${v.toLocaleString()}`} domain={['auto', 'auto']} />
            <Tooltip
              formatter={(v) => [`¥${v.toLocaleString()}`, '総消化']}
              contentStyle={{ fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="totalSpend"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              dot={{ r: 5, fill: '#8b5cf6' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** 前週比バッジ */
function Delta({ label, delta, unit, higher }) {
  if (delta === null) return null
  const improved = higher ? delta > 0 : delta < 0
  const sign = delta > 0 ? '+' : ''
  const color = improved ? 'text-green-600 bg-green-50' : delta === 0 ? 'text-gray-500 bg-gray-50' : 'text-red-500 bg-red-50'
  const arrow = improved ? '↑' : delta === 0 ? '→' : '↓'
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${color}`}>
      {label} {arrow} {sign}{delta}{unit}
    </span>
  )
}
