/**
 * 需密碼閱覽的文章 — Google Apps Script 守門員
 *
 * 這支程式做三件事：
 *   1. 檢查讀者輸入的密碼在不在密碼表裡、有沒有被停用
 *   2. 密碼有效 → 去 private repo 把文章原文抓回來，插上該讀者的 UID 浮水印再回傳
 *   3. 每一次開啟（成功或失敗）都記一行到「開啟紀錄」分頁
 *
 * ⚠️ 這支程式要【綁在 Google Sheet 上】，不要開獨立專案。
 *    開你的密碼表 Sheet → 選單「擴充功能」→「Apps Script」→ 把這整個檔案貼進去。
 *    （綁在 Sheet 上才會有「🔒課金攻略權限」選單可以發密碼。）
 *
 * 完整步驟見 SETUP.md。
 */

// ═══════════════════════════════════════════════════════
// 設定區 — 這幾行要改成你自己的
// ═══════════════════════════════════════════════════════

// 放文章原文的 private repo
const GITHUB_OWNER  = "nakahikari-oss";
const GITHUB_REPO   = "wos-private";   // ← 你建立的 private repo 名稱
const GITHUB_BRANCH = "main";

// 文章代號 → private repo 裡的檔案路徑
// 左邊的代號要和 HTML 檔裡的 window.LOCKED_ARTICLE 一致
const ARTICLES = {
  "spending-guide": "articles/spending-guide.html"
};

// 分頁名稱（程式會自動建立，不用先手動開）
const PW_SHEET  = "密碼表";
const LOG_SHEET = "開啟紀錄";

// 抓回來的文章快取幾秒（避免每次開啟都打 GitHub）
// 你在 private repo push 新版後，最久要等這麼久才會生效；
// 想立刻看到可以用選單「清除文章快取」。
const CACHE_SECONDS = 300;

// 這個 Sheet 的 ID，從 Sheet 網址列複製：
// docs.google.com/spreadsheets/d/【這一段】/edit
const SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";

// ⚠️ GitHub 存取權杖【不要】寫在這個檔案裡（這個檔案會進公開 repo）。
//    請放在「專案設定 → 指令碼屬性」，屬性名稱：GITHUB_TOKEN
const TOKEN_PROPERTY = "GITHUB_TOKEN";

// 密碼用的字元：去掉 0/O、1/I/L 這些容易看錯打錯的
const PW_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const PW_LENGTH = 12;

// 密碼表的欄位順序
const COL_UID     = 1;  // A 遊戲UID
const COL_PW      = 2;  // B 密碼
const COL_WHO     = 3;  // C 發給誰
const COL_ISSUED  = 4;  // D 發放日期
const COL_STATUS  = 5;  // E 狀態（啟用／停用）
const COL_OPENS   = 6;  // F 開啟次數
const COL_LASTOPEN= 7;  // G 最後開啟
const COL_NOTE    = 8;  // H 備註
const PW_COL_COUNT = 8;

const STATUS_ACTIVE  = "啟用";
const STATUS_REVOKED = "停用";

// ═══════════════════════════════════════════════════════
// 網頁端入口
// ═══════════════════════════════════════════════════════

function doPost(e) {
  try {
    let payload;
    if (e.parameter && e.parameter.data) {
      payload = JSON.parse(e.parameter.data);
    } else if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      throw new Error("沒有收到資料");
    }

    if (payload.action === "unlock") {
      return jsonOut(handleUnlock(payload));
    }
    throw new Error("不支援的動作");
  } catch (err) {
    return jsonOut({ status: "error", message: String(err.message || err) });
  }
}

function doGet() {
  return ContentService
    .createTextOutput("Gate backend is live. POST to unlock.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════
// 解鎖流程
// ═══════════════════════════════════════════════════════

function handleUnlock(payload) {
  const articleId = String(payload.article || "").trim();
  const typed = normalizePassword(payload.password);

  if (!ARTICLES[articleId]) {
    return { status: "error", message: "找不到這篇文章" };
  }
  if (!typed) {
    return { status: "error", message: "請輸入密碼" };
  }

  const sheet = getPwSheet();
  const hit = findPasswordRow(sheet, typed);

  if (!hit) {
    // 拖慢猜密碼的速度（正常讀者感覺不出來，暴力破解就幾乎不可能）
    Utilities.sleep(700);
    logAccess(articleId, "密碼錯誤", "", "", typed);
    return { status: "error", message: "密碼不正確。如果是我給你的密碼，請確認有沒有打錯字；還是不行就跟我說一聲。" };
  }

  if (hit.status === STATUS_REVOKED) {
    Utilities.sleep(700);
    logAccess(articleId, "已停用", hit.uid, hit.who, typed);
    return { status: "error", message: "這組密碼已經停用了。需要的話請跟我重新索取。" };
  }

  // 密碼有效 → 抓原文、插浮水印
  let raw;
  try {
    raw = fetchArticleHtml(articleId);
  } catch (err) {
    logAccess(articleId, "抓檔失敗：" + err.message, hit.uid, hit.who, typed);
    return { status: "error", message: "文章暫時讀取失敗，請稍後再試（我這邊會收到紀錄）。" };
  }

  recordOpen(sheet, hit.row);
  logAccess(articleId, "成功", hit.uid, hit.who, typed);

  return {
    status: "ok",
    uid: hit.uid,
    title: extractTitle(raw),
    html: injectWatermarks(raw, hit.uid, hit.who)
  };
}

function normalizePassword(raw) {
  return String(raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** 在密碼表裡找這組密碼，回傳 {row, uid, who, status} 或 null */
function findPasswordRow(sheet, normalizedTyped) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, PW_COL_COUNT).getValues();
  for (let i = 0; i < values.length; i++) {
    const stored = normalizePassword(values[i][COL_PW - 1]);
    if (stored && stored === normalizedTyped) {
      const status = String(values[i][COL_STATUS - 1] || "").trim();
      return {
        row: i + 2,
        uid: String(values[i][COL_UID - 1] || "").trim(),
        who: String(values[i][COL_WHO - 1] || "").trim(),
        status: status === STATUS_REVOKED ? STATUS_REVOKED : STATUS_ACTIVE
      };
    }
  }
  return null;
}

/** 累計開啟次數與最後開啟時間 */
function recordOpen(sheet, row) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const prev = Number(sheet.getRange(row, COL_OPENS).getValue()) || 0;
    sheet.getRange(row, COL_OPENS).setValue(prev + 1);
    sheet.getRange(row, COL_LASTOPEN).setValue(new Date());
  } catch (err) {
    // 計數失敗不影響閱覽
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ═══════════════════════════════════════════════════════
// 從 private repo 抓文章
// ═══════════════════════════════════════════════════════

function fetchArticleHtml(articleId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "article_" + articleId;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const token = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  if (!token) {
    throw new Error("指令碼屬性裡還沒設定 " + TOKEN_PROPERTY);
  }

  const url = "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO +
              "/contents/" + ARTICLES[articleId] + "?ref=" + GITHUB_BRANCH;

  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code === 401 || code === 403) {
    throw new Error("GitHub 權杖無效或過期（HTTP " + code + "）");
  }
  if (code === 404) {
    throw new Error("private repo 裡找不到 " + ARTICLES[articleId]);
  }
  if (code !== 200) {
    throw new Error("GitHub 回應 HTTP " + code);
  }

  const html = res.getContentText("UTF-8");
  // 快取單筆上限約 100KB，太大就不快取
  if (html.length < 90000) {
    cache.put(cacheKey, html, CACHE_SECONDS);
  }
  return html;
}

// ═══════════════════════════════════════════════════════
// 浮水印
// ═══════════════════════════════════════════════════════

function escapeHtml(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWatermark(uid, who, withSignout) {
  const stamp = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm");
  const label = who ? escapeHtml(who) + "（UID <strong>" + escapeHtml(uid) + "</strong>）"
                    : "UID <strong>" + escapeHtml(uid) + "</strong>";
  return '<div class="locked-watermark">本文授權閱覽者：' + label +
         '　・　' + stamp + ' 開啟　・　請勿轉載或外流' +
         (withSignout ? '<button type="button" class="gate-signout">登出</button>' : '') +
         '</div>';
}

/**
 * 在文章開頭、中間、結尾各插一次浮水印。
 * 這樣對方不管截哪一段，圖上都會帶著自己的 UID。
 */
function injectWatermarks(html, uid, who) {
  const top = buildWatermark(uid, who, true);
  const bottom = buildWatermark(uid, who, false);

  const parts = html.split("</p>");
  if (parts.length >= 5) {
    const mid = Math.floor(parts.length / 2);
    parts[mid] = buildWatermark(uid, who, false) + parts[mid];
    html = parts.join("</p>");
  }
  return top + html + bottom;
}

/** 從文章原文抓第一個 <h1> 當頁面標題 */
function extractTitle(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return "";
  return m[1].replace(/<[^>]+>/g, "").trim();
}

// ═══════════════════════════════════════════════════════
// 紀錄
// ═══════════════════════════════════════════════════════

function logAccess(articleId, result, uid, who, typedPassword) {
  try {
    const sheet = getLogSheet();
    sheet.appendRow([
      new Date(),
      articleId,
      result,
      uid || "",
      who || "",
      typedPassword || ""
    ]);
  } catch (err) {
    // 記錄失敗不影響閱覽
  }
}

// ═══════════════════════════════════════════════════════
// 分頁準備
// ═══════════════════════════════════════════════════════

function getSpreadsheet() {
  if (SHEET_ID && SHEET_ID.indexOf("PASTE_") !== 0) {
    return SpreadsheetApp.openById(SHEET_ID);
  }
  // 沒填 SHEET_ID 時退而求其次用所在的 Sheet（在編輯器裡測試時可行，
  // 但網頁被呼叫時不一定抓得到，所以設定區還是請填 SHEET_ID）
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  throw new Error("找不到 Sheet：請在設定區把 SHEET_ID 填成你的 Sheet ID");
}

function getPwSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(PW_SHEET);
  if (!sheet) sheet = ss.insertSheet(PW_SHEET);
  if (sheet.getLastRow() === 0) {
    const header = ["遊戲UID", "密碼", "發給誰", "發放日期", "狀態", "開啟次數", "最後開啟", "備註"];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getLogSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET);
  if (!sheet) sheet = ss.insertSheet(LOG_SHEET);
  if (sheet.getLastRow() === 0) {
    const header = ["時間", "文章", "結果", "遊戲UID", "發給誰", "輸入的密碼"];
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ═══════════════════════════════════════════════════════
// Sheet 選單 — 發密碼、停用、查人都在這裡
// ═══════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🔒 課金攻略權限")
    .addItem("發放新密碼…", "issuePassword")
    .addItem("查密碼是誰的…", "lookupPassword")
    .addSeparator()
    .addItem("停用目前選取的這一列", "revokeSelected")
    .addItem("重新啟用目前選取的這一列", "reactivateSelected")
    .addSeparator()
    .addItem("清除文章快取（讓剛 push 的新版立即生效）", "clearArticleCache")
    .addToUi();
}

/** 產生一組隨機密碼，格式 XXXX-XXXX-XXXX */
function generatePassword() {
  // 用 getUuid()（底層是安全隨機）當亂數來源，不用 Math.random()
  let hex = "";
  while (hex.length < PW_LENGTH * 4) {
    hex += Utilities.getUuid().replace(/-/g, "");
  }
  let out = "";
  let i = 0;
  while (out.length < PW_LENGTH && i + 2 <= hex.length) {
    const v = parseInt(hex.substr(i, 2), 16);
    i += 2;
    // 丟掉會造成分布不均的尾數，保持每個字元機率相同
    if (v >= 248) continue;
    out += PW_ALPHABET.charAt(v % PW_ALPHABET.length);
  }
  return out.substr(0, 4) + "-" + out.substr(4, 4) + "-" + out.substr(8, 4);
}

function issuePassword() {
  const ui = SpreadsheetApp.getUi();

  const r1 = ui.prompt("發放新密碼", "對方的遊戲 UID（頭像下面那串數字）：", ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const uid = r1.getResponseText().trim();
  if (!uid) { ui.alert("UID 不能空白。"); return; }

  const sheet = getPwSheet();

  // 同一個 UID 已經發過就提醒一下
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const uids = sheet.getRange(2, COL_UID, lastRow - 1, 1).getValues();
    for (let i = 0; i < uids.length; i++) {
      if (String(uids[i][0]).trim() === uid) {
        const again = ui.alert(
          "這個 UID 已經發過密碼了",
          "UID " + uid + " 在第 " + (i + 2) + " 列已經有一組密碼。\n\n" +
          "要再發一組新的嗎？（舊的不會自動停用，兩組都會有效）",
          ui.ButtonSet.YES_NO
        );
        if (again !== ui.Button.YES) return;
        break;
      }
    }
  }

  const r2 = ui.prompt("發放新密碼", "這是誰？（遊戲暱稱或備註，可留空）", ui.ButtonSet.OK_CANCEL);
  const who = r2.getSelectedButton() === ui.Button.OK ? r2.getResponseText().trim() : "";

  const pw = generatePassword();
  sheet.appendRow([uid, pw, who, new Date(), STATUS_ACTIVE, 0, "", ""]);

  ui.alert(
    "密碼已發放",
    "UID：" + uid + (who ? "\n對象：" + who : "") + "\n\n密碼：" + pw + "\n\n" +
    "把這組密碼給對方就好。這組密碼只對應這一個 UID，\n" +
    "萬一外流，用「查密碼是誰的」就能查出來源。",
    ui.ButtonSet.OK
  );
}

function lookupPassword() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("查密碼是誰的", "貼上你看到的密碼：", ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;

  const typed = normalizePassword(r.getResponseText());
  if (!typed) { ui.alert("沒有輸入密碼。"); return; }

  const sheet = getPwSheet();
  const hit = findPasswordRow(sheet, typed);
  if (!hit) {
    ui.alert("查無此密碼", "這組密碼不在密碼表裡 —— 可能是對方自己亂打的，或是你已經刪掉那一列了。", ui.ButtonSet.OK);
    return;
  }

  const opens = sheet.getRange(hit.row, COL_OPENS).getValue() || 0;
  const last = sheet.getRange(hit.row, COL_LASTOPEN).getValue();
  ui.alert(
    "找到了",
    "密碼表第 " + hit.row + " 列\n\n" +
    "遊戲 UID：" + hit.uid + "\n" +
    "發給誰：" + (hit.who || "（沒填）") + "\n" +
    "狀態：" + hit.status + "\n" +
    "開啟次數：" + opens + "\n" +
    "最後開啟：" + (last ? last : "（還沒開過）"),
    ui.ButtonSet.OK
  );
  sheet.setActiveRange(sheet.getRange(hit.row, 1, 1, PW_COL_COUNT));
}

function setSelectedStatus(status) {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== PW_SHEET) {
    ui.alert("請先切到「" + PW_SHEET + "」分頁，點一下要處理的那一列，再用這個選單。");
    return;
  }
  const row = sheet.getActiveRange().getRow();
  if (row < 2) { ui.alert("第 1 列是標題，請點資料列。"); return; }

  const uid = sheet.getRange(row, COL_UID).getValue();
  sheet.getRange(row, COL_STATUS).setValue(status);
  ui.alert("第 " + row + " 列（UID " + uid + "）已設為「" + status + "」。\n\n" +
           (status === STATUS_REVOKED ? "對方下次開啟就會被擋下來，不用改網頁。" : "對方可以再次閱覽了。"));
}

function revokeSelected()     { setSelectedStatus(STATUS_REVOKED); }
function reactivateSelected() { setSelectedStatus(STATUS_ACTIVE); }

function clearArticleCache() {
  const cache = CacheService.getScriptCache();
  const keys = Object.keys(ARTICLES).map(function (id) { return "article_" + id; });
  cache.removeAll(keys);
  SpreadsheetApp.getUi().alert("快取已清除，下一次開啟就會抓到 private repo 的最新版。");
}

// ═══════════════════════════════════════════════════════
// 設定完成後可以跑這個檢查
// ═══════════════════════════════════════════════════════

/**
 * 在 Apps Script 編輯器選這個函式按「執行」，可以確認：
 * 權杖有沒有設好、private repo 的檔案抓不抓得到。
 * 結果會出現在下方的「執行紀錄」。
 */
function testSetup() {
  const token = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  Logger.log("GITHUB_TOKEN 有設定嗎：" + (token ? "✅ 有" : "❌ 沒有，請到專案設定→指令碼屬性新增"));

  getPwSheet();
  getLogSheet();
  Logger.log("密碼表／開啟紀錄分頁：✅ 已就緒");

  for (const id in ARTICLES) {
    try {
      CacheService.getScriptCache().remove("article_" + id);
      const html = fetchArticleHtml(id);
      Logger.log("文章「" + id + "」：✅ 抓到了，" + html.length + " 個字元，標題「" + extractTitle(html) + "」");
    } catch (err) {
      Logger.log("文章「" + id + "」：❌ " + err.message);
    }
  }
}
