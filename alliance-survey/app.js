// Alliance Survey — form logic
// Dependencies: heroes-data.js (window.HEROES_DATA), i18n.js (window.I18N)

// ⚠️ REPLACE THIS with your Google Apps Script Web App URL after deployment (see SETUP.md)
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxzJvzEalYGdjhoKED6N1E9Todv_1y5ZI3CVVg_UtBegTIrK9HEO7FhiQdvmQGZJvec-w/exec";

const RTL_LANGS = new Set(["ar"]);
const FALLBACK_LANG = "en";
let currentLang = "en";
const selectedHeroes = new Set();

// ────────────────────────────────────────────────
// i18n
// ────────────────────────────────────────────────
function t(key) {
  const dict = window.I18N[currentLang] || window.I18N[FALLBACK_LANG];
  return dict[key] ?? window.I18N[FALLBACK_LANG][key] ?? key;
}

function setLang(lang) {
  if (!window.I18N[lang]) lang = FALLBACK_LANG;
  currentLang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  document.getElementById("langSel").value = lang;

  // Update all elements with data-i18n
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const attr = el.dataset.i18nAttr;
    const value = t(key);
    if (attr) el.setAttribute(attr, value);
    else el.textContent = value;
  });

  // Re-render hero names in new language
  document.querySelectorAll(".hero-card").forEach(card => {
    const id = card.dataset.heroId;
    const hero = window.HEROES_DATA.find(h => h.id === id);
    const nameEl = card.querySelector(".hero-name");
    if (hero && nameEl) nameEl.textContent = getHeroName(hero);
  });

  // Re-render attendance hour labels (they use {n} template)
  updateAttendanceHourLabels();

  // Persist choice
  try { localStorage.setItem("survey_lang", lang); } catch (e) {}
}

function getHeroName(hero) {
  return hero.name[currentLang] || hero.name.en || hero.id;
}

// ────────────────────────────────────────────────
// Hero grid
// ────────────────────────────────────────────────
function buildHeroGrid() {
  const grid = document.getElementById("heroGrid");
  grid.innerHTML = "";
  for (const hero of window.HEROES_DATA) {
    const card = document.createElement("div");
    card.className = "hero-card";
    card.dataset.heroId = hero.id;
    card.dataset.heroType = hero.type;
    card.innerHTML = `
      <img src="${hero.image}" alt="${hero.name.en}" loading="lazy">
      <div class="hero-name">${getHeroName(hero)}</div>
    `;
    card.addEventListener("click", () => toggleHero(hero.id, card));
    grid.appendChild(card);
  }
}

function toggleHero(id, card) {
  if (selectedHeroes.has(id)) {
    selectedHeroes.delete(id);
    card.classList.remove("selected");
  } else {
    selectedHeroes.add(id);
    card.classList.add("selected");
  }
  updateHeroCount();
}

function updateHeroCount() {
  document.getElementById("heroCount").textContent = selectedHeroes.size;
}

// ────────────────────────────────────────────────
// SVS Attendance
// ────────────────────────────────────────────────
const ATTEND_HOURS = [1, 2, 3, 4, 5];

function buildAttendanceHours() {
  const container = document.getElementById("attendHours");
  container.innerHTML = "";
  for (const n of ATTEND_HOURS) {
    const label = document.createElement("label");
    label.className = "attend-hour-label";
    label.innerHTML = `<input type="checkbox" class="attend-hour" data-hour="${n}"><span data-hour-label="${n}">Hour ${n}</span>`;
    container.appendChild(label);
  }
  updateAttendanceHourLabels();

  // Skip toggle disables hours
  const skipBox = document.getElementById("attendSkip");
  const hoursDiv = container;
  skipBox.addEventListener("change", () => {
    if (skipBox.checked) {
      hoursDiv.classList.add("disabled");
      hoursDiv.querySelectorAll("input").forEach(cb => { cb.checked = false; });
    } else {
      hoursDiv.classList.remove("disabled");
    }
  });
  // Selecting any hour un-checks skip
  hoursDiv.addEventListener("change", (e) => {
    if (e.target.matches(".attend-hour") && e.target.checked && skipBox.checked) {
      skipBox.checked = false;
      hoursDiv.classList.remove("disabled");
    }
  });
}

function updateAttendanceHourLabels() {
  const template = t("attend_hour_template");
  document.querySelectorAll("[data-hour-label]").forEach(el => {
    const n = el.dataset.hourLabel;
    el.textContent = template.replace("{n}", n);
  });
}

function setupHeroFilters() {
  document.querySelectorAll(".hero-filters .filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".hero-filters .filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      document.querySelectorAll(".hero-card").forEach(card => {
        if (filter === "all" || card.dataset.heroType === filter) {
          card.classList.remove("hidden");
        } else {
          card.classList.add("hidden");
        }
      });
    });
  });
}

// ────────────────────────────────────────────────
// Submit
// ────────────────────────────────────────────────
async function submitForm(e) {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  const status = document.getElementById("statusMsg");
  status.style.display = "none";
  btn.disabled = true;
  btn.textContent = t("submitting");

  // Collect data
  const payload = {
    timestamp: new Date().toISOString(),
    lang: currentLang,
    game_id: document.getElementById("gameId").value.trim(),
    ign: document.getElementById("ign").value.trim(),
    alliance: document.getElementById("alliance").value.trim(),
    heroes: Array.from(selectedHeroes),
    heroesCount: selectedHeroes.size,
    troops: {
      infantry_fc: document.getElementById("tp_infantry_fc").value,
      infantry_tier: document.getElementById("tp_infantry_tier").value,
      lancer_fc: document.getElementById("tp_lancer_fc").value,
      lancer_tier: document.getElementById("tp_lancer_tier").value,
      marksman_fc: document.getElementById("tp_marksman_fc").value,
      marksman_tier: document.getElementById("tp_marksman_tier").value
    },
    svs: {
      rally_head: getRadioValue("role_rally_head"),
      rally_body: getRadioValue("role_rally_body"),
      tower: getRadioValue("role_tower"),
      solo: getRadioValue("role_solo")
    },
    attendance: {
      skip: document.getElementById("attendSkip").checked,
      hours: Array.from(document.querySelectorAll(".attend-hour:checked")).map(cb => parseInt(cb.dataset.hour))
    }
  };

  try {
    if (APPS_SCRIPT_URL.startsWith("PASTE_")) {
      // Not yet deployed — show payload in console for testing
      console.log("[Survey] APPS_SCRIPT_URL not configured. Payload:", payload);
      throw new Error("Backend not configured. See SETUP.md.");
    }
    // Note: Apps Script Web Apps often need application/x-www-form-urlencoded to avoid CORS preflight.
    // We stringify the JSON and send it as a single "data" field for simplicity.
    const body = new URLSearchParams({ data: JSON.stringify(payload) });
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: body
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const result = await res.json();
    if (result.status !== "ok") throw new Error(result.message || "Unknown error");

    status.className = "status-msg success";
    status.textContent = t("success");
    status.style.display = "block";
    document.getElementById("surveyForm").reset();
    selectedHeroes.clear();
    updateHeroCount();
    document.querySelectorAll(".hero-card.selected").forEach(c => c.classList.remove("selected"));
    document.getElementById("attendHours").classList.remove("disabled");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    status.className = "status-msg error";
    status.textContent = t("error") + " (" + err.message + ")";
    status.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = t("submit");
  }
  return false;
}

function getRadioValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

// ────────────────────────────────────────────────
// Init
// ────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  buildHeroGrid();
  setupHeroFilters();
  buildAttendanceHours();

  // Language: try localStorage, then browser, then fallback
  let saved = null;
  try { saved = localStorage.getItem("survey_lang"); } catch (e) {}
  const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
  const initialLang = saved || (window.I18N[browser] ? browser : FALLBACK_LANG);
  setLang(initialLang);
});
