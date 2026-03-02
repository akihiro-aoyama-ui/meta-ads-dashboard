/**
 * JSONPリクエストユーティリティ
 * GAS Web AppはCORSに対応していないため、scriptタグ挿入でデータを取得する
 */

/**
 * JSONPリクエストを実行してデータを返す
 * @param {string} url - GAS Web AppのURL
 * @param {Object} params - クエリパラメータ
 * @param {number} timeout - タイムアウト（ミリ秒）
 * @returns {Promise<any>}
 */
export function jsonpFetch(url, params = {}, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const callbackName = `__jsonpCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('タイムアウト: GASからの応答がありませんでした'));
    }, timeout);

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    const script = document.createElement('script');
    const queryParams = new URLSearchParams({ ...params, callback: callbackName });
    script.src = `${url}?${queryParams.toString()}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('GAS Web App URLへの接続に失敗しました'));
    };

    document.body.appendChild(script);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }
  });
}
