// 需密碼閱覽的文章 — 前端密碼門
//
// 這個檔案裡【沒有】文章內容，也【沒有】任何密碼。
// 文章原文存在 private repo，密碼表存在 Google Sheet，
// 兩邊都只有 Apps Script 後端摸得到。密碼正確後才會把內容傳過來。
//
// 頁面需先設定 window.LOCKED_ARTICLE = "文章代號"（見各 HTML 檔）。

// ⚠️ 部署 Apps Script 後，把網頁應用程式 URL 貼到這裡（見 SETUP.md Step 5）
const GATE_API_URL = "PASTE_YOUR_GATE_APPS_SCRIPT_URL_HERE";

const ARTICLE_ID = window.LOCKED_ARTICLE || "";
const STORAGE_KEY = "locked_pw_" + ARTICLE_ID;

// 密碼比對前統一格式：大寫、去掉空白和連字號
function normalizePassword(raw) {
  return String(raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function showError(msg) {
  const box = document.getElementById("gateError");
  box.textContent = msg;
  box.style.display = "block";
}

function clearError() {
  document.getElementById("gateError").style.display = "none";
}

async function unlock(password, opts) {
  const silent = opts && opts.silent;
  const btn = document.getElementById("gateBtn");
  const originalLabel = btn.textContent;

  clearError();
  btn.disabled = true;
  btn.textContent = "確認中…";

  try {
    if (GATE_API_URL.startsWith("PASTE_")) {
      throw new Error("後端還沒設定完成（見 locked/SETUP.md）");
    }

    // 用 form-urlencoded 送，避免 Apps Script 的 CORS preflight 問題
    const body = new URLSearchParams({
      data: JSON.stringify({
        action: "unlock",
        article: ARTICLE_ID,
        password: password
      })
    });

    const res = await fetch(GATE_API_URL, { method: "POST", body: body });
    if (!res.ok) throw new Error("連線失敗（HTTP " + res.status + "）");
    const result = await res.json();

    if (result.status !== "ok") {
      // 密碼錯／被停用時清掉記住的密碼，避免一直自動失敗
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      throw new Error(result.message || "密碼不正確");
    }

    renderArticle(result);

    if (document.getElementById("gateRemember").checked) {
      try { localStorage.setItem(STORAGE_KEY, password); } catch (e) {}
    }
  } catch (err) {
    // 自動解鎖失敗時不要嚇到人，安靜退回密碼輸入畫面
    if (!silent) showError(err.message);
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

function renderArticle(result) {
  document.getElementById("gate").style.display = "none";

  const target = document.getElementById("articleBody");
  target.innerHTML = result.html;
  target.style.display = "block";

  if (result.title) {
    document.title = result.title + " — 克菈莉絲的WOS筆記";
  }

  // 浮水印裡的「登出」：清掉記住的密碼並重新上鎖
  document.querySelectorAll(".gate-signout").forEach(function (el) {
    el.addEventListener("click", function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      location.reload();
    });
  });

  window.scrollTo({ top: 0 });
}

function submitGate(e) {
  e.preventDefault();
  const password = normalizePassword(document.getElementById("gatePw").value);
  if (!password) {
    showError("請輸入密碼");
    return false;
  }
  unlock(password);
  return false;
}

window.addEventListener("DOMContentLoaded", function () {
  document.getElementById("gateForm").addEventListener("submit", submitGate);

  // 之前記住過密碼就直接試一次
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  if (saved) {
    document.getElementById("gatePw").value = saved;
    unlock(saved, { silent: true });
  }
});
