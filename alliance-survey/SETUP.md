# 聯盟問卷 — 部署指南

這份問卷由三部分組成：
1. **前端表單**（`alliance-survey/index.html`）— 已寫好，跟其他網頁一起放在 GitHub Pages 上
2. **Google Sheet**（收資料的地方）— 你要新建一份
3. **Google Apps Script**（把資料寫進 Sheet 的後端）— 你要部署一次

跟著以下步驟做，完整流程約 15 分鐘。

---

## Step 1：建立 Google Sheet

1. 開 [Google Sheets](https://sheets.google.com/) → 新建空白試算表
2. 命名為「聯盟問卷回應」（或任何你喜歡的名字）
3. 從網址列複製 Sheet ID：
   ```
   https://docs.google.com/spreadsheets/d/【這一段就是 SHEET_ID】/edit
   ```
   例如：`1AbC_defGhI_jkL2mnO3PqR_sTuvWxY4Za5bcDe6789`

---

## Step 2：部署 Apps Script

1. 開 [Google Apps Script](https://script.google.com/) → **新增專案**
2. 把整個 `apps-script.gs` 檔案的內容貼進 `Code.gs`（覆蓋預設內容）
3. 找到檔案最上面的這行，把剛才複製的 SHEET_ID 貼進去：
   ```javascript
   const SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";
   ```
   改成：
   ```javascript
   const SHEET_ID = "1AbC_defGhI_jkL2mnO3PqR_sTuvWxY4Za5bcDe6789";
   ```
4. **儲存**（Ctrl+S 或點💾），專案名稱隨便取
5. 點右上角 **「部署」→「新增部署作業」**
6. 齒輪 ⚙️ → 選「網頁應用程式」
7. 設定：
   - **執行身分**：我（`nakahikari@gmail.com`）
   - **具有存取權的使用者**：**任何人**（重要！否則沒登入 Google 帳號的聯盟成員無法送出）
8. 點「部署」
9. 首次會要求授權：
   - 點「授權存取權」
   - 選你的 Google 帳號
   - 出現「Google 尚未驗證這個應用程式」→ 點「進階」→「前往（專案名稱）（不安全）」→ 允許
   - （這是因為是你自己寫的 script，Google 對自製工具都會顯示這個警告。安全。）
10. **複製顯示出來的「網頁應用程式 URL」**，格式類似：
    ```
    https://script.google.com/macros/s/AKfycb...很長.../exec
    ```

---

## Step 3：把 URL 填進前端

1. 用編輯器開 `alliance-survey/app.js`
2. 找到這行：
   ```javascript
   const APPS_SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
   ```
3. 把 `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` 替換成剛複製的 URL
4. `git add alliance-survey/app.js && git commit -m "設定問卷後端 URL" && git push`

---

## Step 4：測試

1. 開 https://（你的GitHub Pages網址）/alliance-survey/
2. 填一份測試資料送出
3. 開你的 Google Sheet 應該會看到多了一行資料 ✓

如果送出失敗：
- 檢查 `app.js` 的 URL 是否貼對
- 檢查 Apps Script 部署時「具有存取權的使用者」有沒有選「任何人」
- 打開瀏覽器 F12 Console 看錯誤訊息

---

## Step 5：把連結分享給聯盟成員

問卷網址就是：
```
https://（你的GitHub Pages網址）/alliance-survey/
```

貼到聯盟頻道、或做成 QR code 都可以。使用者一進來會自動偵測語言，也能手動切換。

---

## 修改與維護

### 想改問題或翻譯
- UI 文字：改 `alliance-survey/i18n.js`
- 兵種選項：改 `alliance-survey/index.html`
- SVS 角色：改 `alliance-survey/index.html` 的 `role-list` 區塊
- 改完 `git push`，前端立即生效

### 有新英雄
1. 更新 `data/heroes.json`
2. 執行下載腳本抓新頭像
3. 重新產生 `heroes-data.js`
4. **同時更新 `apps-script.gs` 的 `HEROES` 陣列**（不要忘，否則新英雄不會顯示在 Sheet 欄位）
5. 在 Apps Script 網頁「部署」→「管理部署作業」→編輯 → 版本改為「新版本」→ 部署
   （URL 不會變）

### 想看漂亮的 Excel 報告
Google Sheet 選 **檔案 → 下載 → Microsoft Excel (.xlsx)** 即可。
Sheet 欄位標題已經是中英雙語，Excel 打開直接可讀。

---

## 幾個進階建議（可選）

- **判斷 SVS 出席資料是否為最新**：出席資料是每場 SVS 都會變的。你可以在 Google Sheet 用「篩選檢視」自動隱藏過期資料：
  1. Responses 分頁 → 選單「資料」→「建立篩選檢視」
  2. 「Last Updated」欄的漏斗圖示 → 「依條件篩選」→「大於或等於」→ 輸入本次 SVS 前的日期（例如 `2026-08-15`）
  3. 沒在這個日期後更新的人會自動隱藏
  4. 篩選檢視可以存起來（右上角命名），下次 SVS 只要改日期即可
- **兩個分頁自動建立**：
  - **`Responses`** — 主表，一個「遊戲 ID」一列。同一人再填一次會直接覆蓋舊列，「Last Updated」欄會更新到最新時間。
  - **`History`** — 只 append，每次送出都新增一列，永遠保留。想比對「這人上次 SVS vs 這次 SVS」就看這個分頁。
  - 兩個分頁欄位結構一樣，你可以隨時把 History 篩選匯出比對。
- **驗證欄位**：目前只驗證 IGN 和 Alliance 有填。如果想強制「英雄至少選 1 隻」，可以在 `app.js` 的 `submitForm` 加檢查。
- **通知**：想每次有人填寫都收 email，可以在 Apps Script 的 `appendRow()` 之後加：
  ```javascript
  MailApp.sendEmail("nakahikari@gmail.com", "新問卷回應", "IGN: " + payload.ign);
  ```
  免費配額每天 100 封，聯盟人數綽綽有餘。
