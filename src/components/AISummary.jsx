import { useState } from 'react'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

/**
 * Gemini AIによる週次サマリーコンポーネント
 * 広告データを渡して改善アクションを日本語150〜200文字で生成する
 */
export default function AISummary({ ads, geminiApiKey }) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generateSummary() {
    if (!geminiApiKey) {
      setError('設定からGemini APIキーを入力してください')
      return
    }
    if (!ads || ads.length === 0) {
      setError('分析する広告データがありません。先にデータを取得してください')
      return
    }

    setLoading(true)
    setError('')
    setSummary('')

    try {
      const totalSpend = ads.reduce((s, a) => s + a.spend, 0)
      const avgCtr = (ads.reduce((s, a) => s + a.ctr, 0) / ads.length).toFixed(2)
      const avgCpc = Math.round(ads.reduce((s, a) => s + a.cpc, 0) / ads.length)

      const adsSummary = ads
        .map(ad => `・${ad.ad_name}｜CTR ${ad.ctr.toFixed(2)}%／CPC ¥${Math.round(ad.cpc)}／消化 ¥${Math.round(ad.spend).toLocaleString()}`)
        .join('\n')

      const prompt = `あなたはMeta広告（Facebook/Instagram）の専門運用者です。
以下は先週（月〜日）の配信中広告のパフォーマンスデータです。

【全体サマリー】
広告数: ${ads.length}本 ／ 総消化: ¥${Math.round(totalSpend).toLocaleString()} ／ 平均CTR: ${avgCtr}% ／ 平均CPC: ¥${avgCpc}

【広告別データ】
${adsSummary}

【判定基準】
- 優秀: CTR 3.0%以上 かつ CPC 20円以下
- 良好: CTR 1.5%以上
- 要改善: それ以外

上記データをもとに、以下の形式で200〜250文字の週次レポートを日本語で作成してください。
①今週の全体評価（1〜2文）
②特に注目すべき広告と理由（1文）
③来週の優先アクション（具体的な施策を1〜2つ、数値根拠付きで）`

      const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
          },
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message || `APIエラー: ${response.status}`)
      }

      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('AIからの応答が空でした')

      setSummary(text.trim())
    } catch (err) {
      setError(`AI分析に失敗しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-purple-600 text-lg">✨</span>
          <h2 className="text-sm font-bold text-gray-800">AI週次サマリー (Gemini)</h2>
        </div>
        <button
          onClick={generateSummary}
          disabled={loading}
          className="text-xs px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? '分析中...' : 'AI分析を実行'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-purple-600">
          <span className="animate-spin">⟳</span>
          Geminiが分析しています...
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {summary && !loading && (
        <p className="text-sm text-gray-700 leading-relaxed bg-white rounded-lg px-4 py-3 border border-purple-100">
          {summary}
        </p>
      )}

      {!summary && !loading && !error && (
        <p className="text-sm text-gray-400">「AI分析を実行」ボタンで週次サマリーを生成します</p>
      )}
    </div>
  )
}
