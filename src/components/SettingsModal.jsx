import { useState } from 'react'

/**
 * 設定モーダル
 * GAS URL、Meta Access Token、Ad Account ID、Gemini API Key を localStorageに保存する
 */
export default function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({ ...settings })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSave() {
    onSave(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <Field
            label="GAS Web App URL"
            name="gasUrl"
            value={form.gasUrl}
            onChange={handleChange}
            placeholder="https://script.google.com/macros/s/..."
            hint="GASスクリプトをWebアプリとしてデプロイ後に表示されるURL"
          />
          <Field
            label="Meta Access Token"
            name="metaToken"
            value={form.metaToken}
            onChange={handleChange}
            placeholder="EAAxxxxxxxx..."
            type="password"
            hint="ads_read権限を持つ無期限トークン"
          />
          <Field
            label="Ad Account ID"
            name="adAccountId"
            value={form.adAccountId}
            onChange={handleChange}
            placeholder="act_123456789"
            hint="act_ で始まる広告アカウントID"
          />
          <Field
            label="Gemini API Key"
            name="geminiApiKey"
            value={form.geminiApiKey}
            onChange={handleChange}
            placeholder="AIzaSy..."
            type="password"
            hint="Google AI Studio で取得したAPIキー"
          />
          <Field
            label="スプレッドシート URL"
            name="spreadsheetUrl"
            value={form.spreadsheetUrl}
            onChange={handleChange}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            hint="データ保存先のGoogle SpreadsheetのURL（ヘッダーにリンクボタンとして表示）"
          />
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, name, value, onChange, placeholder, type = 'text', hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}
