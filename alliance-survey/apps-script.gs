/**
 * Alliance Survey — Google Apps Script backend
 *
 * DEPLOY STEPS (see SETUP.md for detail):
 * 1. Open https://script.google.com/ → New project
 * 2. Paste this entire file into Code.gs (replace default content)
 * 3. Set SHEET_ID below to your Google Sheet's ID
 * 4. Save, then Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the deployed Web app URL → paste into alliance-survey/app.js (APPS_SCRIPT_URL)
 */

// ═══════════════════════════════════════════════════════
// CONFIGURATION — you must fill these in
// ═══════════════════════════════════════════════════════

// Your Google Sheet's ID (from its URL: docs.google.com/spreadsheets/d/THIS_PART/edit)
const SHEET_ID = "12sOxhT5UIDpWqPSdp9d6s0LstpJoBtjnGjv3W8r30zU";

// Main sheet: one row per player, updated in place (upsert by Game ID)
const SHEET_NAME = "Responses";

// History sheet: append-only log of every submission (for comparing over time)
const HISTORY_SHEET_NAME = "History";

// ═══════════════════════════════════════════════════════
// Hero list — must match heroes-data.js (kept in sync manually)
// The order here determines column order in the sheet.
// ═══════════════════════════════════════════════════════
const HEROES = [
  { id: "sergey", en: "Sergey", zh: "謝爾蓋" },
  { id: "jessie", en: "Jessie", zh: "杰西" },
  { id: "patrick", en: "Patrick", zh: "派翠克" },
  { id: "lumak-bokan", en: "Lumak Bokan", zh: "盧姆·波根" },
  { id: "gina", en: "Gina", zh: "吉娜" },
  { id: "bahiti", en: "Bahiti", zh: "巴希提" },
  { id: "natalia", en: "Natalia", zh: "娜塔莉亞" },
  { id: "jeronimo", en: "Jeronimo", zh: "赫羅尼莫" },
  { id: "molly", en: "Molly", zh: "茉莉" },
  { id: "flint", en: "Flint", zh: "弗林特" },
  { id: "philly", en: "Philly", zh: "菲蘭德" },
  { id: "alonso", en: "Alonso", zh: "阿隆索" },
  { id: "logan", en: "Logan", zh: "羅根" },
  { id: "mia", en: "Mia", zh: "米婭" },
  { id: "greg", en: "Greg", zh: "格雷格" },
  { id: "ahmose", en: "Ahmose", zh: "阿赫摩斯" },
  { id: "reina", en: "Reina", zh: "玲奈" },
  { id: "lynn", en: "Lynn", zh: "琳恩" },
  { id: "hector", en: "Hector", zh: "赫克托" },
  { id: "norah", en: "Norah", zh: "諾拉" },
  { id: "gwen", en: "Gwen", zh: "格溫" },
  { id: "wu-ming", en: "Wu Ming", zh: "無名" },
  { id: "renee", en: "Renee", zh: "芮妮" },
  { id: "wayne", en: "Wayne", zh: "韋恩" },
  { id: "edith", en: "Edith", zh: "艾迪絲" },
  { id: "gordon", en: "Gordon", zh: "哥頓" },
  { id: "bradley", en: "Bradley", zh: "布拉德利" },
  { id: "gatot", en: "Gatot", zh: "加托" },
  { id: "sonya", en: "Sonya", zh: "索妮婭" },
  { id: "hendrik", en: "Hendrik", zh: "亨德里克" },
  { id: "magnus", en: "Magnus", zh: "馬格努斯" },
  { id: "fred", en: "Fred", zh: "弗雷德" },
  { id: "xura", en: "Xura", zh: "修拉" },
  { id: "gregory", en: "Gregory", zh: "格里高利" },
  { id: "freya", en: "Freya", zh: "芙蕾雅" },
  { id: "blanchette", en: "Blanchette", zh: "布蘭琪" },
  { id: "eleonora", en: "Eleonora", zh: "埃萊奧諾拉" },
  { id: "lloyd", en: "Lloyd", zh: "勞埃德" },
  { id: "rufus", en: "Rufus", zh: "魯弗斯" },
  { id: "hervor", en: "Hervor", zh: "赫爾薇爾" },
  { id: "karol", en: "Karol", zh: "加羅爾" },
  { id: "ligeia", en: "Ligeia", zh: "麗姬婭" },
  { id: "gisela", en: "Gisela", zh: "吉塞拉" },
  { id: "flora", en: "Flora", zh: "弗洛拉" },
  { id: "vulcanus", en: "Vulcanus", zh: "烏爾卡努斯" },
  { id: "elif", en: "Elif", zh: "艾麗芙" },
  { id: "dominic", en: "Dominic", zh: "多米尼克" },
  { id: "cara", en: "Cara", zh: "卡拉" },
  { id: "hank", en: "Hank", zh: "漢克" },
  { id: "estrella", en: "Estrella", zh: "艾絲黛拉" },
  { id: "viveca", en: "Viveca", zh: "維薇卡" },
  { id: "seigel", en: "Seigel", zh: "西格爾" },
  { id: "ursar", en: "Ursar", zh: "烏爾撒" },
  { id: "aisling", en: "Aisling", zh: "艾詩琳" },
  { id: "aiden", en: "Aiden", zh: "Aiden" },
  { id: "bertha", en: "Bertha", zh: "Bertha" },
  { id: "eleanor", en: "Eleanor", zh: "Eleanor" }
];

// ═══════════════════════════════════════════════════════
// Entry points
// ═══════════════════════════════════════════════════════

/**
 * POST endpoint — the survey form submits here.
 * Accepts either raw JSON body or form-urlencoded "data" field.
 */
function doPost(e) {
  try {
    let payload;
    if (e.parameter && e.parameter.data) {
      payload = JSON.parse(e.parameter.data);
    } else if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      throw new Error("No payload received");
    }

    upsertResponse(payload);
    appendHistory(payload);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET endpoint — used only to verify deployment. Visit the Web app URL in a browser.
 */
function doGet() {
  return ContentService
    .createTextOutput("Alliance Survey backend is live. POST to submit responses.")
    .setMimeType(ContentService.MimeType.TEXT);
}

// ═══════════════════════════════════════════════════════
// Sheet writing
// ═══════════════════════════════════════════════════════

/**
 * Main sheet: one row per Game ID.
 * If the Game ID already exists, overwrite that row. Otherwise append.
 */
function upsertResponse(payload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // Ensure header exists
  if (sheet.getLastRow() === 0) {
    const header = buildHeader();
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
  }

  const row = buildRow(payload);
  const gameIdKey = String(payload.game_id || "").trim();

  // Find existing row with same Game ID (column C = 3rd column)
  const lastRow = sheet.getLastRow();
  let matchedRowNum = -1;
  if (lastRow >= 2 && gameIdKey) {
    const gameIdCol = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
    for (let i = 0; i < gameIdCol.length; i++) {
      if (String(gameIdCol[i][0]).trim() === gameIdKey) {
        matchedRowNum = i + 2; // +2 because we start reading from row 2
        break;
      }
    }
  }

  if (matchedRowNum > 0) {
    // Update existing row in place
    sheet.getRange(matchedRowNum, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

/**
 * History sheet: append every submission, never overwrite.
 * Same column structure as main sheet — you can compare snapshots over time.
 */
function appendHistory(payload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(HISTORY_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(HISTORY_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    const header = buildHeader();
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
  }
  sheet.appendRow(buildRow(payload));
}

function buildHeader() {
  const cols = [
    "Last Updated 最後更新",
    "Language 語言",
    "Game ID 遊戲 ID",
    "IGN 遊戲暱稱",
    "Alliance 聯盟",
    "Hero Count 英雄數"
  ];
  // Troops
  cols.push(
    "Infantry FC 盾兵火晶",
    "Infantry Tier 盾兵階級",
    "Lancer FC 矛兵火晶",
    "Lancer Tier 矛兵階級",
    "Marksman FC 弓兵火晶",
    "Marksman Tier 弓兵階級"
  );
  // SVS
  cols.push(
    "Rally Leader 車頭",
    "Rally Joiner 車身",
    "Turret 打塔",
    "Solo 單打"
  );
  // Attendance (per-round)
  cols.push(
    "Skip 本回請假",
    "H1 第1小時",
    "H2 第2小時",
    "H3 第3小時",
    "H4 第4小時",
    "H5 第5小時"
  );
  // Heroes — one column per hero, bilingual header (skip duplicate if zh == en)
  for (const h of HEROES) {
    cols.push(h.zh && h.zh !== h.en ? h.en + " / " + h.zh : h.en);
  }
  return cols;
}

function buildRow(payload) {
  const owned = new Set(payload.heroes || []);
  const row = [
    payload.timestamp || new Date().toISOString(),
    payload.lang || "",
    payload.game_id || "",
    payload.ign || "",
    payload.alliance || "",
    payload.heroesCount || 0,
    payload.troops.infantry_fc || "",
    payload.troops.infantry_tier || "",
    payload.troops.lancer_fc || "",
    payload.troops.lancer_tier || "",
    payload.troops.marksman_fc || "",
    payload.troops.marksman_tier || "",
    payload.svs.rally_head || "",
    payload.svs.rally_body || "",
    payload.svs.tower || "",
    payload.svs.solo || ""
  ];
  // Attendance
  const att = payload.attendance || {};
  const hoursSet = new Set(att.hours || []);
  row.push(
    att.skip ? "✓" : "",
    hoursSet.has(1) ? "✓" : "",
    hoursSet.has(2) ? "✓" : "",
    hoursSet.has(3) ? "✓" : "",
    hoursSet.has(4) ? "✓" : "",
    hoursSet.has(5) ? "✓" : ""
  );
  for (const h of HEROES) {
    row.push(owned.has(h.id) ? "✓" : "");
  }
  return row;
}
