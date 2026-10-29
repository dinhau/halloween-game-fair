# 麗喆 303 班｜連線修復 v4.2.1

本資料夾直接對應 dinhau/halloween-game-fair 倉庫既有的 live/，請覆蓋合併，不要變成 live/live/。

保留 v4.2 大螢幕橫直自適應、v4.1 手機單畫面、原動畫配樂、單次挑戰與 9.50–10.50 秒成功規則。

Render 設定與原根目錄 render.yaml 相同：Root Directory = live；Build = npm ci && npm test；Start = npm start；Health = /healthz；Node = 22。
不要改用 Static Site，不必建立新服務，不需新增環境變數。

上傳後到原 Render 服務選 Manual Deploy → Deploy latest commit。Restart service 只會重啟舊 commit。
部署後 /healthz 應顯示 version=4.2.1、apiProtocol=lizhe303-rooms-v1；/api/config 應同版本。
電腦重整 /display，手機重整 /phone，再建立房間與掃碼。切勿在遊戲中更新。

測試：npm ci && npm test。完整紀錄在 qa/API_FIX_VALIDATION.md。
原本的舊版 display-live.js、shared.js 等檔案即使留在倉庫，也不再由新版入口載入；不需為修復而手動刪除其他內容。
