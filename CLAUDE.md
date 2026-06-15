# 克菈莉絲的WOS筆記 — 專案說明

## 關於這個專案
- 寒霜啟示錄（Whiteout Survival）個人攻略筆記站
- 純靜態 HTML/CSS 網站，沒有用任何框架或建置工具
- 同一份內容有中文版（根目錄）與英文版（`en/`）
- 兩台電腦輪流開發，靠 `git pull` / `git push` 同步進度

## 檔案結構
- `index.html` — 中文首頁
- `articles.html` — 攻略列表頁
- `calculators.html` — 計算工具列表（規劃中）
- `articles/` — 每篇攻略一個 HTML 檔
- `en/` — 英文版鏡像（中文版改了，英文版也要跟著改）
- `css/style.css` — 全站樣式

## 工作流程
1. **開始工作前**：先執行 `git pull` 拿到另一台電腦的最新進度
2. **編輯／新增**：修改 HTML 或新增 `articles/檔名.html`
3. **結束工作後**：`git add -A` → `git commit -m "說明這次改了什麼"` → `git push`

## 給 Claude 的指示（公開部分）
- 預設用繁體中文回答
- 編輯既有 HTML 就好，**不要**引入框架、bundler、npm 套件
- 新增攻略時：在 `articles/` 加檔案 → 在 `articles.html` 加卡片連結 → 英文版同步更新
- 修改任何內容後，主動提醒使用者要 `commit` + `push`，否則另一台電腦拿不到
- 每次新對話開始時，先建議使用者執行 `git pull`

## 個人偏好（私人）
個人化的工作偏好放在 `CLAUDE.local.md`（不會 commit 到 GitHub），會自動和這份檔案一起讀取。
