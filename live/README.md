# 麗喆303班｜萬聖節雙裝置即時闖關 v4

**這是可部署的程式包，不是已上線網址。** 螢幕與手機需要連到同一個 Node 服務；不是再上傳兩個獨立 HTML 到 GitHub Pages 就能同步。原來的 GitHub Pages 遊戲網站不必刪除或覆蓋。

## 現場效果

- 螢幕沿用 v3 的一般／隱藏兩場景、背景動畫、配樂和魔法音效。
- 手機工作人員確認「抽樓板第一次成功」及「自願以五顆糖兌換」後，開放一局。
- 手機點開始：螢幕轉為「封印挑戰中」，不顯示秒數、倒數或進度。
- 手機點停止：手機本機 `performance.now()` 算出時間，伺服器依顯示至兩位小數的數字判定；螢幕收到結果後顯示巨大秒數、成功／未成功與禮物提示。
- 成功：9.50～10.50秒（含兩端），小禮物1份；未成功：沒有小禮物。五顆糖的兌換由工作人員處理，不與舊700顆糖果庫自動同步。
- 每局完成後鎖定。下一位須工作人員勾選確認；系統不能辨識同一學生是否換人重玩，仍須現場管理。
- 成功有彩紙和短音效；未成功使用友善鼓勵文字，不嚇人、不羞辱。計時中降低配樂、暫停週期短音效，避免額外報秒提示。
- 手機沒有聲音；聲音只從螢幕電腦播放，須按 M 啟動。

## 上傳 GitHub（保留既有網站）

解開「麗喆303班_即時連線版_v4_部署包.zip」，根目錄會有：

```
render.yaml
live/
  package.json
  package-lock.json
  server.mjs
  public/
  tests/
  README.md
```

在原 `dinhau/halloween-game-fair` 專案的根目錄，使用 **Add file → Upload files**，拖入 `live` 整個資料夾及 `render.yaml`，Commit changes。請上傳解壓後的檔案，不是只上傳ZIP。

不需覆蓋原根目錄 `halloween-game-fair.html`。若專案已有 `live/` 或 `render.yaml`，先檢查其用途，不要覆蓋其他服務。

## 部署 Render（建議：一個 Web Service，兩個入口）

### A. Blueprint

1. 在 Render 使用你要部署的工作區（目前已知帳號工作區名稱為 My Workspace，部署前由你確認）。
2. New → Blueprint，連接 `dinhau/halloween-game-fair`，讀取根目錄的 `render.yaml`。
3. 核對服務是 `lize-303-halloween-live`、Node、Singapore、**Free**，再建立。
4. 等待儀表板顯示 Live，開啟 Render 實際分配的網址。首頁有螢幕端與手機端入口。

此模板使用 Free，不會自行升級。若帳號配額不允許或介面要求付費，先停下核對，不要勾選不熟悉的付費項目。

### B. 手動 Web Service

- Repository：`dinhau/halloween-game-fair`
- Branch：`main`
- Root Directory：`live`
- Language / Runtime：Node
- Build Command：`npm ci && npm test`
- Start Command：`npm start`
- Health Check Path：`/healthz`
- Region：Singapore
- Instance Type：Free（正式活動穩定性需求較高時，可自行評估付費型，這份程式不會自動升級）
- Auto Deploy：Off，避免活動中因其他 commit 觸發服務重啟。
- Node 版本：22 或24；模板選22。

**要選 Web Service，不是 Static Site。**

部署完成的兩個入口（下列只是路徑，不是已建立網址）：

- 螢幕：`你的Render網站/display.html`
- 手機：`你的Render網站/phone.html`，第一次以螢幕動態QR連入。

Render提供HTTPS，手機不必與螢幕同一Wi-Fi，只要兩者能連上該服務。

## 活動前配對

1. 電腦開啟 `/display.html`，按「連線手機」或 P。
2. 按「建立配對房間」。螢幕顯示臨時配對QR。
3. 工作人員手機掃描，手機顯示四位驗證碼。
4. 螢幕核對同一組四位碼，再按「核准」。不要核准不認識的裝置。
5. 關閉配對視窗，按 F 全螢幕、M 開聲音；手機確認資格後開局。

一次只綁定一支工作手機。配對QR只在設定視窗出現，成功配對後邀請金鑰會換新；不要把配對連結公開貼給所有同學。訪客不能只靠房間號碼送出成績，還需要邀請與螢幕核准。

## 快捷鍵

- F：全螢幕
- S：一般／隱藏玩法切換（準備或計時中鎖定）
- G：回一般玩法（準備或計時中鎖定）
- P：連線與配對
- M：聲音
- A：動畫
- H：操作列

結果畫面會留著；請在手機或螢幕勾選工作人員確認、按下一位，才回到抽樓板。不要期待結果自動消失。

## 網路、計時與故障處理

- 秒數以手機本機兩次按下的時間差量測，不使用兩台電腦的時鐘差，也不把傳輸時間加到成績。
- 手機完成後先鎖定結果；重複傳送同一局不會更改分數或重複計獎。
- 手機切到背景、重新整理而失去計時資料，會中止本局；不是自動判輸，也不是自動給第二次。由老師依現場情況判定。
- 停止後若短暫連線異常，可按「重新傳送同一結果」。若超過伺服器安全時限或兩端差異太大，改由工作人員確認。
- 目前房間與紀錄存在**單一伺服器記憶體**，服務重啟／重新部署／休眠後可能消失。不要在活動中部署新版；重新啟動後建立新房間、重新掃描。
- 螢幕連線視窗可匯出最近200筆**已完成**結果CSV，不含學生姓名。尚未完成或中止的局數可能使序號有間隔。
- 工作人員仍需人工保管禮物、糖果及資格；這不是身份驗證或防作弊競賽系統。
- Free服務無流量15分鐘會休眠，喚醒會有等待；開場前先測試。不要將免費服務視為正式活動的可用性保證。應保留v3離線展示檔和人工發獎備案。
- API驗證、原始SSE端點、狀態轉移有自動測試；尚未實測正式雲端、實體iPhone／Android或學校網路。

## 不依賴雲端的備援：同一區域網路

電腦安裝Node 22或24，在`live`資料夾執行：

```sh
npm test
npm start
```

螢幕瀏覽器可先開 `http://localhost:3000`；**需要手機掃描時，請把電腦的瀏覽器也改成 `http://電腦的區域網路IP:3000/display.html`**，如此QR才會指向手機可連的地址，而不是手機自己的localhost。

兩台須同Wi-Fi／可互通的熱點，且電腦防火牆允許此私人網路的3000埠。公共Wi-Fi可能禁止裝置互通；不要為此關閉全部防火牆或對外開路由器埠。某些瀏覽器在非HTTPS區域網址不提供防休眠或複製功能，不影響基本手動操作。雲端版優先使用HTTPS。

## 技術與範圍

- Node內建HTTP、crypto與檔案API，零外部執行依賴。
- POST傳送開始／停止／禮物操作，SSE推送狀態；支援重新連線與目前狀態重播。
- 配對授權以暫時隨機金鑰及螢幕核准為主，不使用學生姓名、相機或麥克風。
- QR產生在本機，不呼叫第三方QR服務；固定QR version10-M，可編碼213bytes內網址。
- 無資料庫，請只開1個服務實例，不能直接水平擴充。多攤位／永久成績／多伺服器需再加入共用資料庫與訊息通道。
- 舊版靜態遊戲網頁不會因這份程式自動修改；原先700顆糖庫是獨立系統。

## 官方部署參考

https://render.com/docs/web-services
https://render.com/docs/blueprint-spec
https://render.com/docs/free
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
