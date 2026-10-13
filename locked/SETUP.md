# 需密碼閱覽的文章 — 設定指南

這套東西讓你把某些文章鎖起來，只有拿到密碼的人能看，而且：

- 每個人的密碼都不一樣，**密碼是對應到他的遊戲 UID 的**
- 看到外流的密碼 → 查一下就知道是誰給出去的
- 文章頁面上會印著閱覽者自己的 UID（**連截圖都帶著他的 UID**）
- 某個人外流了 → 在 Sheet 上把他那一列標「停用」，**他立刻就進不去了**
- 你看得到每組密碼被開過幾次、什麼時候開的 → 哪個人在大量轉發一眼就看得出來

## 這套東西怎麼組起來的

```
讀者的瀏覽器
    │  輸入密碼
    ▼
GitHub Pages 的密碼門（locked/spending-guide.html）
    │  把密碼送去問
    ▼
Google Apps Script 守門員 ──查密碼──▶ Google Sheet（密碼表＋開啟紀錄）
    │
    └──密碼有效才去抓原文──▶ private repo（文章真正存放的地方）
```

重點：**文章原文從來沒有出現在公開的網站上**。公開 repo 裡只有一個密碼輸入框。

---

## ⚠️ 開始之前，一件最重要的事

**文章原文一個字都不要放進 `D:\Clarice\WOS`（公開 repo）。**

Git 會永久記住所有改過的版本。就算你今天放進去、明天刪掉，**原文永遠留在 git 歷史裡**，任何人把 repo 載下來都翻得到。要清掉得改寫 git 歷史，很麻煩而且容易把東西弄壞。

所以文章要寫在下面 Step 2 建立的 `D:\Clarice\WOS-private` 裡面。兩個資料夾不要搞混。

---

## Step 1：建立 private repo（瀏覽器，約 1 分鐘）

1. 開 https://github.com/new
2. **Repository name**：`wos-private`
3. 選 **Private**（這個一定要選對！）
4. 不用勾 README
5. 點 **Create repository**

## Step 2：抓到本機

開 PowerShell，貼這幾行：

```powershell
cd D:\Clarice
git clone https://github.com/nakahikari-oss/wos-private.git WOS-private
cd WOS-private
mkdir articles
```

之後文章就寫在 `D:\Clarice\WOS-private\articles\` 裡面。
（另一台電腦也跑一次同樣的 `git clone` 就能同步。）

## Step 3：建立 Google Sheet 和守門員程式

1. 開 https://sheets.google.com/ → 新建空白試算表
2. 命名為「課金攻略權限」
3. **從網址列複製 Sheet ID**（跟當初做問卷一樣）：
   ```
   https://docs.google.com/spreadsheets/d/【這一段就是 Sheet ID】/edit
   ```
4. 選單 **擴充功能 → Apps Script**
   （⚠️ 一定要從 Sheet 裡面開，不要去 script.google.com 開新專案 —— 這樣才會有發密碼的選單）
5. 把 `locked/apps-script.gs` 的**整個內容**貼進 `Code.gs`，覆蓋原本的預設內容
6. 找到設定區這行，把剛複製的 ID 貼進去：
   ```javascript
   const SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";
   ```
7. 專案名稱取「課金攻略守門員」
8. **Ctrl+S 儲存**

## Step 4：給程式一把讀 private repo 的鑰匙

守門員要能去 private repo 拿文章，所以需要一個 GitHub 的「存取權杖」。

1. 開 https://github.com/settings/personal-access-tokens/new
2. 填寫：
   - **Token name**：`wos-gate`
   - **Expiration**：建議選 **1 year**（到期前 GitHub 會寄信提醒你換）
   - **Repository access**：選 **Only select repositories** → 下拉選 `wos-private`
   - **Permissions** → 展開 **Repository permissions** → 找到 **Contents** → 設為 **Read-only**
     （只給讀取權限，就算權杖外流也沒人能改你的東西）
3. 點 **Generate token** → **複製那串 `github_pat_...`**（只會顯示這一次！）
4. 回到 Apps Script 那個分頁：
   - 點左側的 **⚙️ 專案設定**
   - 滑到最下面 **指令碼屬性** → **新增指令碼屬性**
   - **屬性**：`GITHUB_TOKEN`
   - **值**：貼上剛剛複製的權杖
   - 點 **儲存指令碼屬性**

> 權杖放在這裡是安全的：它存在 Google 這邊，只有你的程式讀得到，
> **不會進任何 repo，也絕對不會傳到讀者的瀏覽器**。

## Step 5：部署守門員

1. 在 Apps Script 右上角點 **部署 → 新增部署作業**
2. 齒輪 ⚙️ → 選 **網頁應用程式**
3. 設定：
   - **執行身分**：我（`nakahikari@gmail.com`）
   - **具有存取權的使用者**：**任何人**
     （⚠️ 這個必須選「任何人」，不然沒登入 Google 的讀者會打不開。
     安全性是靠密碼擋，不是靠這個設定。）
4. 點 **部署**
5. 第一次會要求授權：
   - 「授權存取權」→ 選你的 Google 帳號
   - 出現「Google 尚未驗證這個應用程式」→ 點 **進階** → **前往（專案名稱）（不安全）** → **允許**
   - （因為是你自己寫的程式，Google 對所有自製工具都會跳這個警告，正常。）
6. **複製「網頁應用程式 URL」**，長得像：
   ```
   https://script.google.com/macros/s/AKfycb................/exec
   ```

## Step 6：把 URL 填進網頁

1. 開 `D:\Clarice\WOS\locked\gate.js`
2. 找到第 10 行左右：
   ```javascript
   const GATE_API_URL = "PASTE_YOUR_GATE_APPS_SCRIPT_URL_HERE";
   ```
3. 把 `PASTE_...` 換成剛複製的 URL
4. 推上去：
   ```powershell
   cd D:\Clarice\WOS
   git add locked/gate.js
   git commit -m "設定課金攻略守門員 URL"
   git push
   ```

> 這一步如果你想叫我做也可以 —— 把 URL 貼給我就行。

## Step 7：測試

1. 先在 `D:\Clarice\WOS-private\articles\` 放一個測試檔 `spending-guide.html`，內容隨便寫：
   ```html
   <h1>課金指南</h1>
   <p>測試成功，這裡之後換成真正的內容。</p>
   ```
   然後 `git add -A && git commit -m "測試" && git push`

2. 回到 Apps Script，上方函式下拉選 **`testSetup`** → 點 **執行**
   下方「執行紀錄」應該出現：
   ```
   GITHUB_TOKEN 有設定嗎：✅ 有
   密碼表／開啟紀錄分頁：✅ 已就緒
   文章「spending-guide」：✅ 抓到了，...個字元，標題「課金指南」
   ```
   有 ❌ 就照訊息回去檢查對應的 Step。

3. 回到 Google Sheet，**重新整理頁面**（選單要重載才會出現）
   → 上方會多一個選單 **🔒 課金攻略權限**
   → 點 **發放新密碼…** → UID 填你自己的 → 會跳出一組密碼

4. 開 https://nakahikari-oss.github.io/wos/locked/spending-guide.html
   輸入剛拿到的密碼 → 應該看到文章，而且上面印著你的 UID ✓

---

## 平常怎麼用

### 分享給某個人

1. 開 Google Sheet → 選單 **🔒 課金攻略權限 → 發放新密碼…**
2. 輸入對方的**遊戲 UID**，再填一下是誰（暱稱，方便你自己記）
3. 跳出來的密碼複製給對方，連結是：
   ```
   https://nakahikari-oss.github.io/wos/locked/spending-guide.html
   ```

### 看到密碼外流了，想知道是誰

選單 **🔒 課金攻略權限 → 查密碼是誰的…** → 貼上那組密碼
→ 直接告訴你 UID、是誰、開過幾次。

### 要把某個人踢掉

在「密碼表」分頁點一下他那一列 → 選單 **停用目前選取的這一列**
→ 他下次開啟就被擋住了，**不用改網頁、不用重新部署**。

### 想知道有沒有人在偷偷轉發

看「密碼表」的 **開啟次數** 欄。正常人會開個幾次；
如果某組密碼開了幾十次，那組密碼很可能已經在群組裡流傳了。

「開啟紀錄」分頁有更細的資料：每一次開啟的時間，還有**猜錯密碼的紀錄**
（有人在亂試密碼的話會在這裡留下痕跡）。

### 改文章內容

在 `D:\Clarice\WOS-private` 改好 → `git add -A` → `git commit` → `git push`
最久 5 分鐘後自動生效。想立刻生效：選單 **清除文章快取**。

### 之後想再鎖第二篇文章

跟我說就好，我會：
1. 在 private repo 加新的文章檔
2. 在 `apps-script.gs` 的 `ARTICLES` 加一行
3. 複製一份 `locked/spending-guide.html` 改代號

（同一組密碼可以看所有鎖起來的文章，不用重新發。）

### 改了 apps-script.gs 之後

Apps Script 的程式改完要**重新部署**才會生效：
**部署 → 管理部署作業 → ✏️ 編輯 → 版本選「新版本」→ 部署**
（URL 不會變，網頁那邊不用改。）

---

## 老實說：這套東西做不到什麼

**只要內容能被人眼看到，就能被截圖、被複製貼上。** 這是所有內容保護的天花板，不是這套做得不夠好 —— Netflix 花幾億做的 DRM 也擋不住有人拿手機拍螢幕。

所以：

| 外流方式 | 能不能追到 |
|---|---|
| 把**密碼**轉給別人 | ✅ 追得到，而且能立刻停用 |
| **截圖**轉發 | ⚠️ 圖上有他的 UID，追得到（但你得看到那張圖） |
| 把**文字複製**出來重新排版貼出去 | ❌ 追不到 |

這套東西的真正價值是**嚇阻**：對方很清楚「這份東西上面印著我的 UID、克菈莉絲那邊有紀錄」。絕大多數人不會為了分享一篇攻略去冒這個風險。

另外幾個刻意**沒有**做的事，順便說明理由：

- **沒有禁止右鍵／禁止複製**：JavaScript 擋這些三秒就能繞過（關掉 JS、看原始碼、F12），但會讓正常讀者很不舒服。擋不住壞人、只煩到好人，所以不做。
- **沒有限制同一組密碼的使用次數／裝置數**：會誤殺（換手機、清快取、家裡和公司兩台電腦）。用「開啟次數」觀察比硬性封鎖實用得多。
- **沒有把密碼加密存起來**：密碼表在你的私人 Sheet 裡，而且你需要能查「這組密碼是誰的」、也需要能重新告訴對方密碼是什麼。存明文是刻意的選擇。

---

## 檔案清單

**公開 repo（`D:\Clarice\WOS`）** — 這些可以公開，裡面沒有秘密：

| 檔案 | 作用 |
|---|---|
| `locked/spending-guide.html` | 密碼門頁面（**不含文章內容**） |
| `locked/gate.js` | 送密碼去驗證、把回傳的內容顯示出來 |
| `locked/gate.css` | 密碼門和浮水印的樣式 |
| `locked/apps-script.gs` | 守門員程式原始碼（**權杖不在裡面**） |
| `locked/SETUP.md` | 這份文件 |

**private repo（`D:\Clarice\WOS-private`）** — 絕對不公開：

| 檔案 | 作用 |
|---|---|
| `articles/spending-guide.html` | 文章真正的內容 |

**Google 這邊**：

| 東西 | 作用 |
|---|---|
| Sheet「課金攻略權限」 | 密碼表＋開啟紀錄 |
| 指令碼屬性 `GITHUB_TOKEN` | 讀 private repo 的鑰匙 |
