import { useState } from 'react'
import Dashboard from './components/Dashboard'
import SettingsModal from './components/SettingsModal'

const STORAGE_KEY = 'meta_ads_settings'
const AUTH_KEY = 'meta_ads_auth'
const PASSWORD_HASH = '030af9948aa5aa112651666ff042e72b87a1a47de70439362b87b17380d675b8'

const DEFAULT_SETTINGS = {
  gasUrl: '',
  metaToken: '',
  adAccountId: '',
  geminiApiKey: '',
  spreadsheetUrl: '',
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function PasswordGate({ onAuth }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const hash = await hashPassword(pw)
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem(AUTH_KEY, 'true')
      onAuth()
    } else {
      setError(true)
      setPw('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 w-full max-w-sm">
        <h1 className="text-lg font-bold text-gray-800 text-center mb-1">Meta広告ダッシュボード</h1>
        <p className="text-xs text-gray-400 text-center mb-6">アクセスにはパスワードが必要です</p>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false) }}
          placeholder="パスワード"
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          autoFocus
        />
        {error && <p className="text-red-500 text-xs mb-3">パスワードが正しくありません</p>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          ログイン
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === 'true')
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />
  }

  function handleSaveSettings(newSettings) {
    setSettings(newSettings)
    saveSettings(newSettings)
  }

  // 設定が未完了の場合は初回に自動で設定を開く
  const isFirstTime = !settings.gasUrl && !settings.metaToken

  return (
    <>
      <Dashboard
        settings={settings}
        onOpenSettings={() => setShowSettings(true)}
      />

      {(showSettings || isFirstTime) && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  )
}
