/**
 * 広告パフォーマンス判定ロジック
 *
 * 優秀: CTR >= 3.0% かつ CPC <= 20円
 * 良好: CTR >= 1.5%
 * 要改善: それ以外
 */

export const PERFORMANCE_LEVELS = {
  EXCELLENT: '優秀',
  GOOD: '良好',
  REVIEW: '要改善',
}

/**
 * CTR と CPC からパフォーマンスレベルを判定する
 */
export function getPerformanceLevel(ctr, cpc) {
  if (ctr >= 3.0 && cpc <= 20) return PERFORMANCE_LEVELS.EXCELLENT
  if (ctr >= 1.5) return PERFORMANCE_LEVELS.GOOD
  return PERFORMANCE_LEVELS.REVIEW
}

/**
 * パフォーマンスレベルに対応するTailwindクラスを返す
 */
export function getPerformanceBadgeClass(level) {
  switch (level) {
    case PERFORMANCE_LEVELS.EXCELLENT:
      return 'bg-green-100 text-green-800 border border-green-300'
    case PERFORMANCE_LEVELS.GOOD:
      return 'bg-blue-100 text-blue-800 border border-blue-300'
    case PERFORMANCE_LEVELS.REVIEW:
    default:
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300'
  }
}

/**
 * 広告の良い点・改善案をルールベースで生成する（広告運用者視点）
 * 実際の数値を含めて各広告ごとに異なるコメントを生成する
 * @returns {{ good: string[], more: string[] }}
 */
export function getAdInsights(ctr, cpc, spend) {
  const good = []
  const more = []

  const ctrStr = ctr.toFixed(2)
  const cpcStr = Math.round(cpc).toLocaleString()
  const spendStr = Math.round(spend).toLocaleString()

  // CTR評価
  if (ctr >= 5.0) {
    good.push(`CTR ${ctrStr}%は業界トップクラス。このクリエイティブの訴求軸・ターゲットを他広告にも横展開すべき`)
  } else if (ctr >= 3.0) {
    good.push(`CTR ${ctrStr}%で平均の約2倍。サムネイルか冒頭3秒の引きが強く、オーディエンスとのマッチ精度が高い`)
  } else if (ctr >= 2.0) {
    good.push(`CTR ${ctrStr}%で業界平均（約1.5%）を上回る。現行クリエイティブの方向性は正しい`)
    more.push(`CTR ${ctrStr}%→3%超えを目指し、冒頭フックのテキストパターンを2〜3案でA/Bテスト`)
  } else if (ctr >= 1.5) {
    more.push(`CTR ${ctrStr}%は標準範囲だが伸びしろあり。サムネイルの色・文字量を変えたパターンでテスト推奨`)
  } else if (ctr >= 0.5) {
    more.push(`CTR ${ctrStr}%は平均を下回る。ファーストカット（冒頭1秒）の映像とコピーを刷新`)
  } else {
    more.push(`CTR ${ctrStr}%は極めて低い。ターゲット設定・配信面・クリエイティブ全体を根本から見直す`)
  }

  // CPC評価
  if (cpc === 0) {
    // CPC0はクリックなしの可能性
  } else if (cpc <= 10) {
    good.push(`CPC ¥${cpcStr}は超低コスト。入札上限を若干引き上げてリーチ拡大を検討`)
  } else if (cpc <= 20) {
    good.push(`CPC ¥${cpcStr}で費用対効果が非常に高い。現状の入札戦略・オーディエンス設定を維持`)
  } else if (cpc <= 50) {
    good.push(`CPC ¥${cpcStr}は許容範囲内。CVRが確保できていれば現状維持でOK`)
  } else if (cpc <= 100) {
    more.push(`CPC ¥${cpcStr}はやや高め。入札戦略を「最低コスト」に変更するか、類似オーディエンスを拡張して競合を分散させる`)
  } else {
    more.push(`CPC ¥${cpcStr}は高コスト。競合過多のオーディエンスの可能性あり。広告セット単位で入札上限（¥${Math.round(cpc * 0.7).toLocaleString()}円程度）を設定`)
  }

  // CTR低×CPC高の複合悪化
  if (ctr < 1.5 && cpc > 100) {
    more.push(`CTR ${ctrStr}%・CPC ¥${cpcStr}の両方が悪化。配信を一時停止し、広告セット単位でターゲット・入札・クリエイティブを全面見直し`)
  }

  // CTR高いのにCPC高い → ランディング問題やオーディエンス問題
  if (ctr >= 2.0 && cpc > 80) {
    more.push(`CTRは${ctrStr}%と高いがCPCが¥${cpcStr}と高い。クリック後のLPとのメッセージマッチを確認し、LPのファーストビューを最適化`)
  }

  // 消化金額による学習フェーズ評価
  if (spend > 0 && spend < 300) {
    more.push(`消化¥${spendStr}は少なく、アルゴリズムの学習データが不足。1日予算を上げるか配信期間を7日以上確保`)
  } else if (spend >= 300 && spend < 1000) {
    more.push(`消化¥${spendStr}で学習フェーズ途中。予算を増やして早期に学習完了させると精度が向上`)
  } else if (spend >= 10000) {
    good.push(`消化¥${spendStr}で十分な配信実績あり。このパフォーマンスデータを基に次の広告設計が可能`)
  }

  return { good, more }
}
