import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages用: リポジトリ名を base に設定（例: /meta-ads-dashboard/）
// VITE_BASE_URL 環境変数が設定されていればそれを使用、なければ '/'
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_URL || '/',
})
