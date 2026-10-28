# Codex 接手部署說明

目標：在使用者既有 GitHub 專案 dinhau/halloween-game-fair 新增 live/ 與根目錄 render.yaml，不覆蓋原 halloween-game-fair.html，再在使用者確認的 Render 工作區建立一個 Node Web Service。

先檢查 GitHub 與 Render 的實際寫入工具／CLI認證。此交付環境只有讀取連線工具，所以沒有完成任何上傳或建立服務；不要沿用「已部署」的假設。

1. 閱讀 README.md，執行 `npm test`（18項Node測試）。
2. 確認 repo 現有 live/ 與 render.yaml 不屬於其他服務。新增前備份與檢查差異，不用 force push。
3. 本資料夾內容放 repo 的 live/；其 render.yaml 另放 repo 根目錄。rootDir設定為live。
4. 使用者已要求發布，但 Render工作區仍須依工具要求由使用者確認。已知候選工作區 My Workspace。不要擅自挑選其他工作區。
5. 模板選 Free，不能默默開付費服務。不可改變其他專案或帳號權限。
6. 新服務先檢查 /healthz、/display.html、/phone.html，再以兩個獨立瀏覽器情境配對，實際開始／停止測試成功和未成功兩種分數。
7. 額外測試分頁隱藏、同局重送、重新整理顯示端、撤銷配對、下一位及禮物登記。使用實體手機做觸控與音效預演。
8. 只有實際HTTP成功與雲端互通驗證後才能回報正式URL；不能猜 onrender.com 子網域。

目前已完成Node API測試、QR矩陣比對，以及隔離瀏覽器測試轉接下的兩端操作與截圖；不是雲端E2E驗證，詳見qa/QA_NOTES.md。
