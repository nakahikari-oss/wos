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
const SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";

// Sheet tab name where responses will be appended
const SHEET_NAME = "Responses";

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
  { id: "jeronimo", en: "Jeronimo", zh: "傑羅尼莫" },
  { id: "molly", en: "Molly", zh: "莫莉" },
  { id: "flint", en: "Flint", zh: "弗林特" },
  { id: "philly", en: "Philly", zh: "菲莉" },
  { id: "alonso", en: "Alonso", zh: "阿隆索" },
  { id: "logan", en: "Logan", zh: "洛根" },
  { id: "mia", en: "Mia", zh: "米亞" },
  { id: "greg", en: "Greg", zh: "格雷格" },
  { id: "ahmose", en: "Ahmose", zh: "阿摩斯" },
  { id: "reina", en: "Reina", zh: "蕾娜" },
  { id: "lynn", en: "Lynn", zh: "琳恩" },
  { id: "hector", en: "Hector", zh: "赫克托" },
  { id: "norah", en: "Norah", zh: "諾拉" },
  { id: "gwen", en: "Gwen", zh: "格溫" },
  { id: "wu-ming", en: "Wu Ming", zh: "無名" },
  { id: "renee", en: "Renee", zh: "雷妮" },
  { id: "wayne", en: "Wayne", zh: "韋恩" },
  { id: "edith", en: "Edith", zh: "伊迪絲" },
  { id: "gordon", en: "Gordon", zh: "戈登" },
  { id: "bradley", en: "Bradley", zh: "布拉德利" },
  { id: "gatot", en: "Gatot", zh: "加托特" },
  { id: "sonya", en: "Sonya", zh: "索尼婭" },
  { id: "hendrik", en: "Hendrik", zh: "亨德里克" },
  { id: "magnus", en: "Magnus", zh: "馬格納斯" },
  { id: "fred", en: "Fred", zh: "弗雷德" },
  { id: "xura", en: "Xura", zh: "祖拉" },
  { id: "gregory", en: "Gregory", zh: "格雷戈里" },
  { id: "freya", en: "Freya", zh: "芙蕾雅" },
  { id: "blanchette", en: "Blanchette", zh: "布蘭雪" },
  { id: "eleonora", en: "Eleonora", zh: "埃萊奧諾拉" },
  { id: "lloyd", en: "Lloyd", zh: "洛伊德" },
  { id: "rufus", en: "Rufus", zh: "魯弗斯" },
  { id: "hervor", en: "Hervor", zh: "赫爾沃" },
  { id: "karol", en: "Karol", zh: "卡羅爾" },
  { id: "ligeia", en: "Ligeia", zh: "利蓋亞" },
  { id: "gisela", en: "Gisela", zh: "吉塞拉" },
  { id: "flora", en: "Flora", zh: "芙蘿拉" },
  { id: "vulcanus", en: "Vulcanus", zh: "瓦爾坎努斯" },
  { id: "elif", en: "Elif", zh: "艾麗芙" },
  { id: "dominic", en: "Dominic", zh: "多米尼克" },
  { id: "cara", en: "Cara", zh: "卡拉" },
  { id: "hank", en: "Hank", zh: "漢克" },
  { id: "estrella", en: "Estrella", zh: "艾絲翠拉" },
  { id: "viveca", en: "Viveca", zh: "薇薇卡" },
  { id: "seigel", en: "Seigel", zh: "賽格爾" },
  { id: "ursar", en: "Ursar", zh: "烏爾薩" },
  { id: "aisling", en: "Aisling", zh: "艾詩琳" },
  { id: "aiden", en: "Aiden", zh: "艾登" },
  { id: "bertha", en: "Bertha", zh: "貝爾塔" },
  { id: "eleanor", en: "Eleanor", zh: "埃莉諾" }
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

    appendRow(payload);
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

function appendRow(payload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // If sheet is empty, write bilingual header row first
  if (sheet.getLastRow() === 0) {
    const header = buildHeader();
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
    // Bold header
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
  }

  const row = buildRow(payload);
  sheet.appendRow(row);
}

function buildHeader() {
  const cols = [
    "Timestamp 時間",
    "Language 語言",
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
    "Tower 打塔",
    "Solo 單打"
  );
  // Heroes — one column per hero, bilingual header
  for (const h of HEROES) {
    cols.push(h.en + " / " + h.zh);
  }
  return cols;
}

function buildRow(payload) {
  const owned = new Set(payload.heroes || []);
  const row = [
    payload.timestamp || new Date().toISOString(),
    payload.lang || "",
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
  for (const h of HEROES) {
    row.push(owned.has(h.id) ? "✓" : "");
  }
  return row;
}
