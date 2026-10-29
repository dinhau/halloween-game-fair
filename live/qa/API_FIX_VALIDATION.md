# v4.2.1 API 相容性修復驗證

日期：2026-10-29。

## 原因
已透過 GitHub 連接工具讀取 dinhau/halloween-game-fair 的 live/server.mjs、live/public/live-client.js、live/public/live-display.js 與根目錄 render.yaml。
伺服器 blob a9d6d27b15fcc63b5a4606121ad27f529791ee25 回傳 {room, token, state}；新前端 Session.adopt 讀取 creds.id，因此後續出現 /api/rooms/undefined/pairing。
舊後端也沒有新版本的 /api/config、/api/pair 以及統一 /action 協定。不能只把 room 改名 id 就視為修復。
本機以相同 SHA 的舊伺服器重現 201 建房後 404「找不到 API」。見 legacy-error-reproduction.json（無憑證）。

## 修復
統一使用 v4.2 RWD / v4.1 手機版所對應的 rooms-v1 後端；補齊 vendor/ QR 套件與授權、package-lock 與配套測試。
版本為 4.2.1，apiProtocol 為 lizhe303-rooms-v1。
前端建立房間／手機配對前會確認協定；無效 id 不會被保存或用來拼接 API。
改用新 sessionStorage key，重新部署後需重新配對。沒有自動搬移舊房間與發獎紀錄。
靜態檔 no-store，關鍵前端腳本附版本查詢字串，避免跨版本快取。

## 實際驗證
npm ci --ignore-scripts 成功。npm test：35 項通過、0 項失敗。
含既有 23 項後端測試及新增 12 項 API 相容性測試：
- 真實 HTTP 伺服器與透過 Node VM 執行的前端 live-client.js 互通。
- 建房、QR 配對、開局、停止、成功／未成功、禮物去重、下一位。
- 舊後端協定拒絕、失敗後重試、HTML/靜態網站錯誤、無效 id 與舊憑證。
- HTML 載入的 JS/CSS 路徑回應200，橫直 CSS 與手機觸控標記仍存在。
- 既有 SSE 測試使用真實 HTTP串流，不是模擬回傳。

本次沒有執行 Samsung 電視實機、手機 Safari 觸控、音效聆聽或 Render 上線驗收。
沒有上傳 GitHub，沒有重新部署 Render，沒有修改雲端房間。
