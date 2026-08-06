// app.js — Main application logic for The Investor's Lens
// Handles navigation, rendering, localStorage persistence, and scorecard.
//
// Security notes:
//  * Everything rendered through innerHTML goes through escapeHtml(), which is
//    safe for text nodes and for quoted attribute values alike.
//  * State restored from localStorage or an imported backup file is untrusted:
//    sanitizeState() rebuilds it against the MODULES schema, so unknown keys
//    (including __proto__) are dropped rather than merged in.

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────
  const STORAGE_KEY = "investorsLens";
  const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
  const SAVE_DEBOUNCE = 800;        // ms after typing stops
  const BACKUP_VERSION = 1;

  // Bounds applied to anything read back from storage or an import file.
  const MAX_TEXT_LEN = 20000;
  const MAX_CELL_LEN = 2000;
  const MAX_NAME_LEN = 200;
  const MAX_TABLE_ROWS = 200;

  const SCORECARD_SENTINEL = 10; // meta.currentModule value meaning "scorecard"

  // ── State ──────────────────────────────────────────────
  function freshState() {
    return {
      meta: { firmName: "", userName: "", lastSaved: null, currentModule: 0 },
      modules: {},
      scorecard: { ratings: {}, reflection1: "", reflection2: "" }
    };
  }

  let state = freshState();
  let currentView = "landing"; // "landing" | "module" | "scorecard"
  let currentModuleIndex = 0;  // 0-indexed into MODULES
  let saveFailed = false;
  let saveDebounceTimer = null;

  // ── DOM References ─────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);

  const elHeader       = $("#app-header");
  const elSidebar      = $("#sidebar");
  const elSidebarList  = $("#sidebar-list");
  const elBottomNav    = $("#bottom-nav");
  const elProgressWrap = $("#progress-track");
  const elProgressFill = $("#progress-fill");
  const elToast        = $("#toast");
  const elStorageWarn  = $("#storage-warning");
  const elSaveStatus   = $("#save-status");

  // Landing
  const elPageLanding  = $("#page-landing");
  const elInputFirm    = $("#input-firm-name");
  const elInputUser    = $("#input-user-name");
  const elBtnBegin     = $("#btn-begin");
  const elResumePrompt = $("#resume-prompt");
  const elResumeModNum = $("#resume-module-num");
  const elBtnResume    = $("#btn-resume");

  // Module / scorecard
  const elPageModule     = $("#page-module");
  const elModContainer   = $("#module-container");
  const elPageScorecard  = $("#page-scorecard");
  const elScoreContainer = $("#scorecard-container");

  // Nav & data buttons
  const elBtnBack        = $("#btn-back");
  const elBtnNext        = $("#btn-next");
  const elBtnSaveHeader  = $("#btn-save-header");
  const elBtnSaveBottom  = $("#btn-save-bottom");
  const elBtnStartOver   = $("#btn-start-over");
  const elBtnExport      = $("#btn-export");
  const elBtnImport      = $("#btn-import");
  const elImportFile     = $("#input-import-file");
  const elSidebarToggle  = $("#sidebar-toggle");
  const elFirmNameHeader = $("#header-firm-name");

  // ── Escaping ───────────────────────────────────────────

  // Safe for text content AND for values inside quoted HTML attributes.
  // A textContent/innerHTML round-trip leaves " and ' unescaped, which allowed
  // attribute-injection XSS from saved table and checklist values.
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── Sanitizing untrusted state ─────────────────────────

  function safeString(value, maxLen) {
    if (typeof value !== "string") return "";
    return value.length > maxLen ? value.slice(0, maxLen) : value;
  }

  // Rebuilds state from scratch against the MODULES schema. Anything the schema
  // does not describe is discarded, so a corrupt or tampered payload cannot
  // introduce unexpected keys or prototype entries.
  function sanitizeState(raw) {
    const clean = freshState();
    if (!raw || typeof raw !== "object") return clean;

    const meta = (raw.meta && typeof raw.meta === "object") ? raw.meta : {};
    clean.meta.firmName = safeString(meta.firmName, MAX_NAME_LEN);
    clean.meta.userName = safeString(meta.userName, MAX_NAME_LEN);
    clean.meta.lastSaved = safeString(meta.lastSaved, 40) || null;
    const cm = Number(meta.currentModule);
    clean.meta.currentModule =
      Number.isFinite(cm) && cm >= 0 && cm <= SCORECARD_SENTINEL ? Math.floor(cm) : 0;

    const rawModules = (raw.modules && typeof raw.modules === "object") ? raw.modules : {};
    MODULES.forEach((mod) => {
      const src = rawModules[mod.id];
      if (!src || typeof src !== "object") return;
      const dst = {};

      mod.fields.forEach((field) => {
        const value = src[field.id];
        if (value === undefined || value === null) return;

        if (field.type === "textarea-short" || field.type === "textarea-long") {
          if (typeof value === "string") dst[field.id] = safeString(value, MAX_TEXT_LEN);

        } else if (field.type === "table") {
          if (!Array.isArray(value)) return;
          const colCount = field.columns.length;
          const rows = [];
          value.slice(0, MAX_TABLE_ROWS).forEach((row) => {
            if (!Array.isArray(row)) return;
            const cells = [];
            for (let c = 0; c < colCount; c++) cells.push(safeString(row[c], MAX_CELL_LEN));
            rows.push(cells);
          });
          dst[field.id] = rows;

        } else if (field.type === "checklist") {
          if (typeof value !== "object") return;
          const checks = {};
          field.items.forEach((_, i) => { if (value[i] === true) checks[i] = true; });
          if (field.hasOther) {
            if (value.other === true) checks.other = true;
            if (typeof value.otherText === "string") {
              checks.otherText = safeString(value.otherText, MAX_CELL_LEN);
            }
          }
          dst[field.id] = checks;
        }
      });

      if (Object.keys(dst).length > 0) clean.modules[mod.id] = dst;
    });

    const sc = (raw.scorecard && typeof raw.scorecard === "object") ? raw.scorecard : {};
    const ratings = (sc.ratings && typeof sc.ratings === "object") ? sc.ratings : {};
    SCORECARD_DIMENSIONS.forEach((dim) => {
      const n = Number(ratings[dim.id]);
      if (Number.isFinite(n) && n >= 1 && n <= 5) clean.scorecard.ratings[dim.id] = Math.floor(n);
    });
    clean.scorecard.reflection1 = safeString(sc.reflection1, MAX_TEXT_LEN);
    clean.scorecard.reflection2 = safeString(sc.reflection2, MAX_TEXT_LEN);

    return clean;
  }

  // ── Feedback ───────────────────────────────────────────

  let toastHideTimer = null;
  let toastClearTimer = null;

  function showToast(msg, isError) {
    clearTimeout(toastHideTimer);
    clearTimeout(toastClearTimer);
    elToast.textContent = msg;
    elToast.classList.toggle("toast-error", !!isError);
    elToast.classList.remove("hidden");
    void elToast.offsetWidth; // restart the transition on repeat toasts
    elToast.classList.add("show");
    toastHideTimer = setTimeout(() => { elToast.classList.remove("show"); }, isError ? 5000 : 2000);
    toastClearTimer = setTimeout(() => { elToast.classList.add("hidden"); }, isError ? 5300 : 2300);
  }

  // Used by pdf-generator.js so PDF problems surface as toasts, not alert().
  window.ILNotify = showToast;

  function showStorageWarning(msg) {
    elStorageWarn.textContent = msg;
    elStorageWarn.classList.remove("hidden");
  }

  function hideStorageWarning() {
    elStorageWarn.classList.add("hidden");
  }

  function relativeTime(iso) {
    const then = Date.parse(iso);
    if (!Number.isFinite(then)) return "";
    const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (secs < 10) return "Saved just now";
    if (secs < 60) return "Saved " + secs + "s ago";
    const mins = Math.round(secs / 60);
    if (mins < 60) return "Saved " + mins + " min ago";
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return "Saved " + hrs + "h ago";
    return "Saved " + new Date(then).toLocaleDateString();
  }

  function updateSaveStatus() {
    if (!elSaveStatus) return;
    if (saveFailed) {
      elSaveStatus.textContent = "Not saved";
      elSaveStatus.classList.add("is-error");
      return;
    }
    elSaveStatus.classList.remove("is-error");
    elSaveStatus.textContent = state.meta.lastSaved ? relativeTime(state.meta.lastSaved) : "";
  }

  // ── localStorage ───────────────────────────────────────

  function saveState() {
    const previous = state.meta.lastSaved;
    state.meta.lastSaved = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (saveFailed) hideStorageWarning();
      saveFailed = false;
      updateSaveStatus();
      return true;
    } catch (e) {
      state.meta.lastSaved = previous;
      saveFailed = true;
      updateSaveStatus();
      showStorageWarning(
        "This browser would not save your work — storage may be full, or you may be in " +
        "private browsing. Use the Backup button to download your answers before closing this tab."
      );
      console.warn("Could not save to localStorage:", e);
      return false;
    }
  }

  function scheduleSave() {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(function () {
      collectCurrentPageData();
      saveState();
    }, SAVE_DEBOUNCE);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      state = sanitizeState(JSON.parse(raw));
      return true;
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
      return false;
    }
  }

  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn("Could not clear localStorage:", e);
    }
    state = freshState();
    saveFailed = false;
    hideStorageWarning();
    updateSaveStatus();
  }

  // ── Completion checks ──────────────────────────────────

  // A prefilled row label (e.g. "Total revenue") is not user content, so a cell
  // counts only when it is non-empty AND differs from its prefill value.
  function tableHasContent(field, rows) {
    if (!Array.isArray(rows)) return false;
    const prefill = field.prefillRows || [];
    return rows.some((row, ri) =>
      Array.isArray(row) && row.some((cell, ci) => {
        const val = String(cell === null || cell === undefined ? "" : cell).trim();
        if (val === "") return false;
        const preRow = prefill[ri];
        const preVal = String(preRow && preRow[ci] != null ? preRow[ci] : "").trim();
        return val !== preVal;
      })
    );
  }

  function checklistHasContent(value) {
    if (!value || typeof value !== "object") return false;
    return Object.keys(value).some((k) =>
      k === "otherText" ? String(value[k]).trim() !== "" : value[k] === true
    );
  }

  function moduleHasContent(moduleId) {
    const mod = MODULES.find((m) => m.id === moduleId);
    const data = state.modules[moduleId];
    if (!mod || !data) return false;
    return mod.fields.some((field) => {
      const value = data[field.id];
      if (value === undefined || value === null) return false;
      if (field.type === "table") return tableHasContent(field, value);
      if (field.type === "checklist") return checklistHasContent(value);
      return String(value).trim() !== "";
    });
  }

  function scorecardComplete() {
    return SCORECARD_DIMENSIONS.every((dim) => state.scorecard.ratings[dim.id] > 0);
  }

  // ── Collect form data from the DOM ─────────────────────

  function collectModuleData(moduleId) {
    const mod = MODULES.find((m) => m.id === moduleId);
    if (!mod) return;
    const data = state.modules[moduleId] || {};

    mod.fields.forEach((field) => {
      if (field.type === "textarea-short" || field.type === "textarea-long") {
        const el = document.getElementById("field-" + field.id);
        if (el) data[field.id] = el.value;

      } else if (field.type === "table") {
        const tableEl = document.getElementById("table-" + field.id);
        if (tableEl) {
          const tableData = [];
          tableEl.querySelectorAll("tbody tr").forEach((tr) => {
            const cells = [];
            tr.querySelectorAll('input[type="text"]').forEach((inp) => cells.push(inp.value));
            tableData.push(cells);
          });
          data[field.id] = tableData;
        }

      } else if (field.type === "checklist") {
        // Only rewrite the checklist when its inputs are actually on screen,
        // otherwise a stale call would erase the saved answers.
        const firstBox = document.getElementById("check-" + field.id + "-0");
        if (!firstBox) return;
        const checks = {};
        field.items.forEach((item, i) => {
          const cb = document.getElementById("check-" + field.id + "-" + i);
          if (cb && cb.checked) checks[i] = true;
        });
        if (field.hasOther) {
          const otherCb = document.getElementById("check-" + field.id + "-other");
          const otherInput = document.getElementById("check-" + field.id + "-other-text");
          if (otherCb && otherCb.checked) checks.other = true;
          if (otherInput && otherInput.value) checks.otherText = otherInput.value;
        }
        data[field.id] = checks;
      }
    });

    state.modules[moduleId] = data;
  }

  function collectScorecardData() {
    SCORECARD_DIMENSIONS.forEach((dim) => {
      const selected = document.querySelector('input[name="score-' + dim.id + '"]:checked');
      if (selected) state.scorecard.ratings[dim.id] = parseInt(selected.value, 10);
    });
    const r1 = document.getElementById("reflection1");
    const r2 = document.getElementById("reflection2");
    if (r1) state.scorecard.reflection1 = r1.value;
    if (r2) state.scorecard.reflection2 = r2.value;
  }

  function collectCurrentPageData() {
    if (currentView === "module" && MODULES[currentModuleIndex]) {
      collectModuleData(MODULES[currentModuleIndex].id);
    } else if (currentView === "scorecard") {
      collectScorecardData();
    }
  }

  // ── Render Helpers ─────────────────────────────────────

  function renderTextarea(field, savedValue) {
    const cls = field.type === "textarea-short" ? "short" : "long";
    const id = "field-" + field.id;
    const hintId = id + "-hint";
    return '<div class="form-field">' +
      '<label for="' + escapeHtml(id) + '">' + escapeHtml(field.id + " " + field.label) + '</label>' +
      (field.hint
        ? '<span class="field-hint" id="' + escapeHtml(hintId) + '">' + escapeHtml(field.hint) + '</span>'
        : '') +
      '<textarea id="' + escapeHtml(id) + '" class="' + cls + '" maxlength="' + MAX_TEXT_LEN + '"' +
        (field.hint ? ' aria-describedby="' + escapeHtml(hintId) + '"' : '') + '>' +
        escapeHtml(savedValue || "") +
      '</textarea>' +
      '</div>';
  }

  function renderTableRow(field, row, rowIndex) {
    let html = '<tr>';
    field.columns.forEach((col, ci) => {
      const cell = (row && row[ci] !== undefined && row[ci] !== null) ? row[ci] : "";
      html += '<td><input type="text" maxlength="' + MAX_CELL_LEN + '" ' +
        'value="' + escapeHtml(cell) + '" ' +
        'aria-label="' + escapeHtml(col + ", row " + (rowIndex + 1) + " of " + field.label) + '"></td>';
    });
    html += '<td class="col-actions">' +
      '<button type="button" class="row-remove" ' +
      'data-table-remove="' + escapeHtml(field.id) + '" ' +
      'aria-label="' + escapeHtml("Remove row " + (rowIndex + 1) + " of " + field.label) + '" ' +
      'title="Remove row">&#215;</button></td>';
    html += '</tr>';
    return html;
  }

  function renderTable(field, savedData) {
    let html = '<div class="form-field">' +
      '<span class="field-label">' + escapeHtml(field.id + " " + field.label) + '</span>' +
      '<div class="table-wrapper">' +
      '<table class="data-table" id="table-' + escapeHtml(field.id) + '">' +
      '<thead><tr>';

    field.columns.forEach((col) => {
      html += '<th scope="col">' + escapeHtml(col) + '</th>';
    });
    html += '<th scope="col" class="col-actions"><span class="visually-hidden">Row actions</span></th>';
    html += '</tr></thead><tbody>';

    const rows = (Array.isArray(savedData) && savedData.length > 0) ? savedData : field.prefillRows;
    rows.forEach((row, ri) => { html += renderTableRow(field, row, ri); });

    html += '</tbody></table></div>' +
      '<div class="table-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" data-table-add="' + escapeHtml(field.id) + '">+ Add Row</button>' +
      '</div></div>';
    return html;
  }

  function renderChecklist(field, savedData) {
    const data = savedData || {};
    let html = '<div class="form-field">' +
      '<span class="field-label">' + escapeHtml(field.id + " " + field.label) + '</span>' +
      '<ul class="checklist">';

    field.items.forEach((item, i) => {
      const id = "check-" + field.id + "-" + i;
      html += '<li>' +
        '<input type="checkbox" id="' + escapeHtml(id) + '"' + (data[i] ? ' checked' : '') + '>' +
        '<label for="' + escapeHtml(id) + '">' + escapeHtml(item) + '</label>' +
        '</li>';
    });

    if (field.hasOther) {
      const otherId = "check-" + field.id + "-other";
      const otherTextId = otherId + "-text";
      html += '<li>' +
        '<input type="checkbox" id="' + escapeHtml(otherId) + '"' + (data.other ? ' checked' : '') + '>' +
        '<label for="' + escapeHtml(otherId) + '">Other:</label>' +
        '<input type="text" class="other-input" id="' + escapeHtml(otherTextId) + '" ' +
        'maxlength="' + MAX_CELL_LEN + '" ' +
        'value="' + escapeHtml(data.otherText || "") + '" placeholder="Describe..." ' +
        'aria-label="Describe other item">' +
        '</li>';
    }

    html += '</ul></div>';
    return html;
  }

  // Row numbers appear in aria-labels, so refresh them after add/remove.
  function renumberTable(tableEl, field) {
    tableEl.querySelectorAll("tbody tr").forEach((tr, ri) => {
      tr.querySelectorAll('input[type="text"]').forEach((inp, ci) => {
        inp.setAttribute("aria-label", (field.columns[ci] || "") + ", row " + (ri + 1) + " of " + field.label);
      });
      const removeBtn = tr.querySelector(".row-remove");
      if (removeBtn) {
        removeBtn.setAttribute("aria-label", "Remove row " + (ri + 1) + " of " + field.label);
      }
    });
  }

  // ── Render Module Page ─────────────────────────────────

  function renderModule(index) {
    const mod = MODULES[index];
    const saved = state.modules[mod.id] || {};

    let html = '<span class="module-number">Module ' + mod.id + ' of ' + MODULES.length + '</span>' +
      '<h2 class="module-title">' + escapeHtml(mod.title) + '</h2>' +
      '<p class="module-subtitle">"' + escapeHtml(mod.subtitle) + '"</p>' +
      '<hr class="module-rule">' +
      '<p class="module-intro">' + escapeHtml(mod.intro) + '</p>' +
      '<div class="callout">' + escapeHtml(mod.callout) + '</div>';

    mod.fields.forEach((field) => {
      if (field.type === "textarea-short" || field.type === "textarea-long") {
        html += renderTextarea(field, saved[field.id]);
      } else if (field.type === "table") {
        html += renderTable(field, saved[field.id]);
      } else if (field.type === "checklist") {
        html += renderChecklist(field, saved[field.id]);
      }
    });

    elModContainer.innerHTML = html;
  }

  // The module container is reused across renders, so its listeners are bound
  // exactly once and resolve the active module at event time. Re-binding them
  // inside renderModule would stack one stale handler per module visited.
  function bindModuleContainerEvents() {
    function activeModule() {
      return currentView === "module" ? MODULES[currentModuleIndex] : null;
    }

    function persist() {
      const mod = activeModule();
      if (!mod) return;
      collectModuleData(mod.id);
      saveState();
      refreshModuleStatus();
    }

    elModContainer.addEventListener("click", function (e) {
      const mod = activeModule();
      if (!mod) return;

      const addBtn = e.target.closest("[data-table-add]");
      if (addBtn) {
        const field = mod.fields.find((f) => f.id === addBtn.getAttribute("data-table-add"));
        if (!field) return;
        const tableEl = document.getElementById("table-" + field.id);
        if (!tableEl) return;
        const tbody = tableEl.querySelector("tbody");
        if (tbody.rows.length >= MAX_TABLE_ROWS) {
          showToast("Maximum of " + MAX_TABLE_ROWS + " rows reached.");
          return;
        }
        tbody.insertAdjacentHTML("beforeend", renderTableRow(field, [], tbody.rows.length));
        renumberTable(tableEl, field);
        const newRow = tbody.rows[tbody.rows.length - 1];
        const firstInput = newRow && newRow.querySelector("input");
        if (firstInput) firstInput.focus();
        persist();
        return;
      }

      const removeBtn = e.target.closest("[data-table-remove]");
      if (removeBtn) {
        const field = mod.fields.find((f) => f.id === removeBtn.getAttribute("data-table-remove"));
        if (!field) return;
        const tableEl = document.getElementById("table-" + field.id);
        const tr = removeBtn.closest("tr");
        if (!tableEl || !tr) return;
        tr.remove();
        renumberTable(tableEl, field);
        persist();
        showToast("Row removed.");
      }
    });

    // blur does not bubble, so listen in the capture phase.
    elModContainer.addEventListener("blur", function (e) {
      if (e.target.matches && e.target.matches("textarea, input")) persist();
    }, true);

    // Debounced save while typing, so a crash or accidental close loses at
    // most a second of work rather than up to a full autosave interval.
    elModContainer.addEventListener("input", function (e) {
      if (e.target.matches && e.target.matches("textarea, input")) scheduleSave();
    });

    elModContainer.addEventListener("change", function (e) {
      if (e.target.matches && e.target.matches('input[type="checkbox"]')) persist();
    });
  }

  // ── Render Scorecard ───────────────────────────────────

  function totalScore() {
    let total = 0;
    SCORECARD_DIMENSIONS.forEach((dim) => {
      const v = state.scorecard.ratings[dim.id];
      if (Number.isFinite(v)) total += v;
    });
    return total;
  }

  function renderScorecard() {
    const ratings = state.scorecard.ratings || {};
    const maxScore = SCORECARD_DIMENSIONS.length * 5;
    const rated = SCORECARD_DIMENSIONS.filter((d) => ratings[d.id] > 0).length;

    let html = '<div class="scorecard-header">' +
      '<span class="module-number">Self-Assessment</span>' +
      '<h2 class="module-title">Investor-Readiness Scorecard</h2>' +
      '<p class="module-subtitle">"How would an investor grade your firm?"</p>' +
      '<hr class="module-rule">' +
      '<div class="scorecard-total" id="scorecard-total">' + totalScore() +
        '<span class="scorecard-total-label"> / ' + maxScore + '</span></div>' +
      '<p class="scorecard-hint" id="scorecard-rated">' + rated + ' of ' +
        SCORECARD_DIMENSIONS.length + ' dimensions rated</p>' +
      '</div>';

    html += '<div class="chart-container">' +
      '<canvas id="scorecard-chart" role="img" aria-label="Bar chart of scorecard ratings"></canvas>' +
      '</div>';

    SCORECARD_DIMENSIONS.forEach((dim) => {
      const val = ratings[dim.id] || 0;
      const labelId = "score-label-" + dim.id;
      const descId = "score-desc-" + dim.id;

      html += '<div class="score-dimension">' +
        '<div class="score-dim-header">' +
        '<span class="score-dim-label" id="' + labelId + '">' + dim.id + '. ' + escapeHtml(dim.label) + '</span>' +
        '<span class="score-dim-value" id="dim-val-' + dim.id + '">' + (val || "—") + '</span>' +
        '</div>' +
        '<p class="score-dim-desc" id="' + descId + '">' + escapeHtml(dim.description) + '</p>' +
        '<div class="score-radio-group" role="radiogroup" ' +
          'aria-labelledby="' + labelId + '" aria-describedby="' + descId + '">';

      for (let i = 1; i <= 5; i++) {
        html += '<label class="' + (val === i ? "selected" : "") + '">' +
          '<input type="radio" name="score-' + dim.id + '" value="' + i + '"' +
          (val === i ? " checked" : "") +
          ' aria-label="' + escapeHtml(dim.label + ": " + i + " out of 5") + '">' +
          '<span aria-hidden="true">' + i + '</span></label>';
      }
      html += '</div></div>';
    });

    html += '<div class="reflection-section">' +
      '<div class="form-field">' +
      '<label for="reflection1">What are the 3 most important things you learned from this exercise?</label>' +
      '<textarea id="reflection1" class="long" maxlength="' + MAX_TEXT_LEN + '">' +
        escapeHtml(state.scorecard.reflection1 || "") + '</textarea>' +
      '</div>' +
      '<div class="form-field">' +
      '<label for="reflection2">What are the 3 most urgent actions you will take in the next 90 days?</label>' +
      '<textarea id="reflection2" class="long" maxlength="' + MAX_TEXT_LEN + '">' +
        escapeHtml(state.scorecard.reflection2 || "") + '</textarea>' +
      '</div>' +
      '</div>';

    html += '<div class="pdf-section">' +
      '<button type="button" id="btn-generate-pdf" class="btn btn-gold btn-lg">Generate My Prospectus (PDF)</button>' +
      '<p class="pdf-note">The PDF is built in your browser and downloaded straight to this device.</p>' +
      '</div>';

    elScoreContainer.innerHTML = html;

    // These listeners live on freshly created nodes, so they are discarded
    // along with the markup on the next render.
    elScoreContainer.querySelectorAll('.score-radio-group input[type="radio"]').forEach((radio) => {
      radio.addEventListener("change", function () {
        const dimId = this.name.replace("score-", "");
        const val = parseInt(this.value, 10);
        state.scorecard.ratings[dimId] = val;

        const group = this.closest(".score-radio-group");
        group.querySelectorAll("label").forEach((l) => l.classList.remove("selected"));
        this.closest("label").classList.add("selected");

        const dimValEl = document.getElementById("dim-val-" + dimId);
        if (dimValEl) dimValEl.textContent = val;

        const totalEl = document.getElementById("scorecard-total");
        if (totalEl) {
          totalEl.innerHTML = totalScore() +
            '<span class="scorecard-total-label"> / ' + maxScore + '</span>';
        }
        const ratedEl = document.getElementById("scorecard-rated");
        if (ratedEl) {
          const n = SCORECARD_DIMENSIONS.filter((d) => state.scorecard.ratings[d.id] > 0).length;
          ratedEl.textContent = n + " of " + SCORECARD_DIMENSIONS.length + " dimensions rated";
        }

        saveState();
        refreshScorecardStatus();
        drawChart();
      });
    });

    const r1 = document.getElementById("reflection1");
    const r2 = document.getElementById("reflection2");
    if (r1) {
      r1.addEventListener("blur", function () { state.scorecard.reflection1 = this.value; saveState(); });
      r1.addEventListener("input", scheduleSave);
    }
    if (r2) {
      r2.addEventListener("blur", function () { state.scorecard.reflection2 = this.value; saveState(); });
      r2.addEventListener("input", scheduleSave);
    }

    document.getElementById("btn-generate-pdf").addEventListener("click", function () {
      collectScorecardData();
      saveState();
      if (typeof window.generatePDF === "function") {
        window.generatePDF(state, MODULES, SCORECARD_DIMENSIONS);
      } else {
        showToast("PDF generator is not loaded. Try reloading the page.", true);
      }
    });

    drawChart();
  }

  // ── Chart ──────────────────────────────────────────────

  function drawRoundRect(ctx, x, y, w, h, r) {
    const width = Math.max(w, 0);
    const radius = Math.max(0, Math.min(r, width / 2, h / 2));
    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, h, radius);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + h - radius);
    ctx.quadraticCurveTo(x + width, y + h, x + width - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  function drawChart() {
    const canvas = document.getElementById("scorecard-chart");
    if (!canvas) return;

    const container = canvas.parentElement;
    const available = container && container.clientWidth ? container.clientWidth : 480;
    const cssW = Math.max(280, Math.min(480, available));
    const barH = 22;
    const gap = 6;
    const startY = 10;
    const cssH = startY * 2 + SCORECARD_DIMENSIONS.length * (barH + gap);

    // Render at device pixel ratio so the chart is crisp on high-DPI screens.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const ratings = state.scorecard.ratings || {};
    const labelW = Math.round(cssW * 0.34);
    const valueW = 34;
    const barMaxW = Math.max(20, cssW - labelW - valueW - 12);

    SCORECARD_DIMENSIONS.forEach((dim, i) => {
      const y = startY + i * (barH + gap);
      const val = ratings[dim.id] || 0;

      ctx.fillStyle = "#1B2A4A";
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      // Truncate rather than let long labels run under the bars.
      let label = dim.label;
      while (label.length > 4 && ctx.measureText(label).width > labelW - 10) {
        label = label.slice(0, -2);
      }
      ctx.fillText(label === dim.label ? label : label + "…", labelW - 10, y + barH / 2);

      ctx.fillStyle = "#E8EDF5";
      ctx.beginPath();
      drawRoundRect(ctx, labelW, y, barMaxW, barH, 4);
      ctx.fill();

      if (val > 0) {
        ctx.fillStyle = val >= 4 ? "#059669" : val >= 3 ? "#C4A35A" : "#DC2626";
        ctx.beginPath();
        drawRoundRect(ctx, labelW, y, (val / 5) * barMaxW, barH, 4);
        ctx.fill();
      }

      ctx.fillStyle = "#1B2A4A";
      ctx.font = "bold 12px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(val > 0 ? val + "/5" : "—", labelW + barMaxW + 8, y + barH / 2);
    });

    canvas.setAttribute("aria-label", "Scorecard ratings. " + SCORECARD_DIMENSIONS
      .map((d) => d.label + ": " + (ratings[d.id] ? ratings[d.id] + " of 5" : "not rated"))
      .join("; "));
  }

  // ── Navigation ─────────────────────────────────────────

  function showPage(view, moduleIdx) {
    collectCurrentPageData();

    currentView = view;
    // Drives the landing-only layout: with the header, sidebar and bottom bar
    // hidden, the space reserved for them has to be reclaimed too.
    document.body.classList.toggle("is-landing", view === "landing");

    elPageLanding.classList.add("hidden");
    elPageModule.classList.add("hidden");
    elPageScorecard.classList.add("hidden");

    if (view === "landing") {
      elHeader.classList.add("hidden");
      elSidebar.classList.add("hidden");
      elBottomNav.classList.add("hidden");
      elPageLanding.classList.remove("hidden");
      return;
    }

    elHeader.classList.remove("hidden");
    elSidebar.classList.remove("hidden");
    elBottomNav.classList.remove("hidden");
    elFirmNameHeader.textContent = state.meta.firmName || "";

    if (view === "module") {
      const idx = Math.max(0, Math.min(MODULES.length - 1, moduleIdx | 0));
      currentModuleIndex = idx;
      state.meta.currentModule = MODULES[idx].id;
      elPageModule.classList.remove("hidden");
      renderModule(idx);
      window.scrollTo(0, 0);
      elPageModule.focus({ preventScroll: true });
    } else if (view === "scorecard") {
      state.meta.currentModule = SCORECARD_SENTINEL;
      elPageScorecard.classList.remove("hidden");
      renderScorecard();
      window.scrollTo(0, 0);
      elPageScorecard.focus({ preventScroll: true });
    }

    updateSidebar();
    updateProgressBar();
    updateNavButtons();
    saveState();
  }

  // Progress reflects how much is actually filled in, not how far the user has
  // clicked — a position-based bar read "90% done" on a completely empty form.
  function updateProgressBar() {
    let done = 0;
    MODULES.forEach((m) => { if (moduleHasContent(m.id)) done += 1; });
    if (scorecardComplete()) done += 1;
    const pct = Math.round((done / (MODULES.length + 1)) * 100);
    elProgressFill.style.width = pct + "%";
    if (elProgressWrap) {
      elProgressWrap.setAttribute("aria-valuenow", String(pct));
      elProgressWrap.setAttribute("aria-valuetext", pct + "% complete");
    }
  }

  function updateNavButtons() {
    if (currentView === "module") {
      elBtnBack.disabled = currentModuleIndex === 0;
      // Reset explicitly: reaching the scorecard used to disable Next
      // permanently, stranding anyone who navigated back into a module.
      elBtnNext.disabled = false;
      elBtnNext.textContent = currentModuleIndex === MODULES.length - 1
        ? "Scorecard →"
        : "Next Module →";
    } else if (currentView === "scorecard") {
      elBtnBack.disabled = false;
      elBtnNext.disabled = false;
      elBtnNext.textContent = "Generate PDF";
    }
  }

  function checkMarkup(srLabel) {
    return '<span class="mod-check"><span aria-hidden="true">✓</span>' +
      '<span class="visually-hidden"> ' + srLabel + '</span></span>';
  }

  function updateSidebar() {
    let html = "";
    MODULES.forEach((mod, i) => {
      const active = currentView === "module" && currentModuleIndex === i;
      html += '<li>' +
        '<button type="button" class="sidebar-item' + (active ? " active" : "") + '" ' +
        'data-module="' + i + '"' + (active ? ' aria-current="step"' : "") + '>' +
        '<span class="mod-num" aria-hidden="true">' + mod.id + '</span>' +
        '<span class="mod-title">' + escapeHtml(mod.title) + '</span>' +
        (moduleHasContent(mod.id) ? checkMarkup("has answers") : "") +
        '</button></li>';
    });

    const scActive = currentView === "scorecard";
    html += '<li class="scorecard-item">' +
      '<button type="button" class="sidebar-item' + (scActive ? " active" : "") + '" ' +
      'data-module="scorecard"' + (scActive ? ' aria-current="step"' : "") + '>' +
      '<span class="mod-num" aria-hidden="true">★</span>' +
      '<span class="mod-title">Scorecard</span>' +
      (scorecardComplete() ? checkMarkup("complete") : "") +
      '</button></li>';

    elSidebarList.innerHTML = html;

    elSidebarList.querySelectorAll(".sidebar-item").forEach((btn) => {
      btn.addEventListener("click", function () {
        const idx = this.getAttribute("data-module");
        if (idx === "scorecard") showPage("scorecard");
        else showPage("module", parseInt(idx, 10));
        closeSidebar();
      });
    });
  }

  // Patch the existing sidebar entry in place. Rebuilding the whole list from a
  // blur handler would destroy the button the user is mid-click on, so the
  // click would never land.
  function patchSidebarCheck(selector, done, srLabel) {
    const btn = elSidebarList.querySelector(selector);
    if (!btn) return;
    const existing = btn.querySelector(".mod-check");
    if (done && !existing) btn.insertAdjacentHTML("beforeend", checkMarkup(srLabel));
    else if (!done && existing) existing.remove();
  }

  function refreshModuleStatus() {
    updateProgressBar();
    const mod = MODULES[currentModuleIndex];
    if (!mod) return;
    patchSidebarCheck(
      '.sidebar-item[data-module="' + currentModuleIndex + '"]',
      moduleHasContent(mod.id),
      "has answers"
    );
  }

  function refreshScorecardStatus() {
    updateProgressBar();
    patchSidebarCheck('.sidebar-item[data-module="scorecard"]', scorecardComplete(), "complete");
  }

  function openSidebar() {
    elSidebar.classList.add("open");
    elSidebarToggle.setAttribute("aria-expanded", "true");
  }

  function closeSidebar() {
    elSidebar.classList.remove("open");
    elSidebarToggle.setAttribute("aria-expanded", "false");
  }

  // ── Backup / Restore ───────────────────────────────────

  function fileSafeName(str) {
    const cleaned = String(str || "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return cleaned || "firm";
  }

  function exportData() {
    collectCurrentPageData();
    saveState();
    const payload = {
      app: "investorsLens",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: state
    };
    let url;
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileSafeName(state.meta.firmName) + "_InvestorsLens_backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Backup downloaded.");
    } catch (e) {
      console.error("Export failed:", e);
      showToast("Could not create the backup file.", true);
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }

  function importData(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("That file is too large to be a valid backup.", true);
      return;
    }
    const reader = new FileReader();
    reader.onerror = function () { showToast("Could not read that file.", true); };
    reader.onload = function () {
      let payload;
      try {
        payload = JSON.parse(String(reader.result));
      } catch (e) {
        showToast("That file is not a valid Investor's Lens backup.", true);
        return;
      }
      const raw = (payload && typeof payload === "object" && payload.data) ? payload.data : payload;
      const incoming = sanitizeState(raw);

      const hasAnswers =
        Object.keys(incoming.modules).length > 0 ||
        Object.keys(incoming.scorecard.ratings).length > 0 ||
        incoming.meta.firmName !== "";
      if (!hasAnswers) {
        showToast("That backup file did not contain any answers.", true);
        return;
      }

      const existing = Object.keys(state.modules).length > 0 || state.meta.firmName !== "";
      if (existing && !window.confirm(
        "Restoring this backup will replace the answers currently in this browser. Continue?"
      )) {
        return;
      }

      state = incoming;
      saveState();
      elInputFirm.value = state.meta.firmName;
      elInputUser.value = state.meta.userName;

      if (state.meta.currentModule === SCORECARD_SENTINEL) {
        showPage("scorecard");
      } else {
        const idx = MODULES.findIndex((m) => m.id === state.meta.currentModule);
        showPage("module", idx >= 0 ? idx : 0);
      }
      showToast("Backup restored.");
    };
    reader.readAsText(file);
  }

  // ── Event Handlers ─────────────────────────────────────

  elBtnBegin.addEventListener("click", function () {
    const firm = elInputFirm.value.trim();
    const user = elInputUser.value.trim();
    if (!firm) {
      elInputFirm.classList.add("input-error");
      elInputFirm.focus();
      showToast("Please enter your firm name to begin.", true);
      return;
    }
    elInputFirm.classList.remove("input-error");
    state.meta.firmName = firm;
    state.meta.userName = user;
    saveState();
    showPage("module", 0);
  });

  elInputFirm.addEventListener("input", function () {
    this.classList.remove("input-error");
  });

  elBtnResume.addEventListener("click", function () {
    if (state.meta.currentModule === SCORECARD_SENTINEL) {
      showPage("scorecard");
    } else {
      const idx = MODULES.findIndex((m) => m.id === state.meta.currentModule);
      showPage("module", idx >= 0 ? idx : 0);
    }
  });

  elBtnBack.addEventListener("click", function () {
    if (currentView === "scorecard") {
      showPage("module", MODULES.length - 1);
    } else if (currentView === "module" && currentModuleIndex > 0) {
      showPage("module", currentModuleIndex - 1);
    }
  });

  elBtnNext.addEventListener("click", function () {
    if (currentView === "module") {
      if (currentModuleIndex < MODULES.length - 1) showPage("module", currentModuleIndex + 1);
      else showPage("scorecard");
    } else if (currentView === "scorecard") {
      const pdfBtn = document.getElementById("btn-generate-pdf");
      if (pdfBtn) {
        pdfBtn.scrollIntoView({ block: "center" });
        pdfBtn.click();
      }
    }
  });

  function handleSave() {
    collectCurrentPageData();
    if (saveState()) {
      showToast("Progress saved.");
      updateProgressBar();
      if (currentView === "module") refreshModuleStatus();
      else if (currentView === "scorecard") refreshScorecardStatus();
    }
  }

  elBtnSaveHeader.addEventListener("click", handleSave);
  elBtnSaveBottom.addEventListener("click", handleSave);
  elBtnExport.addEventListener("click", exportData);

  elBtnImport.addEventListener("click", function () { elImportFile.click(); });
  elImportFile.addEventListener("change", function () {
    importData(this.files && this.files[0]);
    this.value = ""; // allow re-importing the same filename
  });

  elBtnStartOver.addEventListener("click", function () {
    if (!window.confirm(
      "Erase all of your answers on this device? This cannot be undone.\n\n" +
      "If you want a copy first, cancel and use the Backup button."
    )) return;
    clearState();
    showPage("landing");
    elInputFirm.value = "";
    elInputUser.value = "";
    elResumePrompt.classList.add("hidden");
    showToast("All data erased.");
  });

  elSidebarToggle.addEventListener("click", function (e) {
    e.stopPropagation();
    if (elSidebar.classList.contains("open")) closeSidebar();
    else openSidebar();
  });

  document.addEventListener("click", function (e) {
    if (elSidebar.classList.contains("open") &&
        !elSidebar.contains(e.target) &&
        e.target !== elSidebarToggle) {
      closeSidebar();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && elSidebar.classList.contains("open")) {
      closeSidebar();
      elSidebarToggle.focus();
    }
  });

  [elInputFirm, elInputUser].forEach(function (el) {
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter") elBtnBegin.click();
    });
  });

  // ── Persistence timers & lifecycle ─────────────────────

  setInterval(function () {
    if (currentView !== "landing") {
      collectCurrentPageData();
      saveState();
    }
  }, AUTO_SAVE_INTERVAL);

  // Keep the "Saved N min ago" label honest between saves.
  setInterval(updateSaveStatus, 20000);

  function flush() {
    if (currentView === "landing") return;
    clearTimeout(saveDebounceTimer);
    collectCurrentPageData();
    saveState();
  }

  window.addEventListener("beforeunload", flush);
  // pagehide/visibilitychange are the reliable signals on mobile browsers.
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    if (currentView !== "scorecard") return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawChart, 150);
  });

  // ── Initialize ─────────────────────────────────────────
  function init() {
    bindModuleContainerEvents();

    const hasSaved = loadState();
    if (hasSaved && state.meta.firmName) {
      elInputFirm.value = state.meta.firmName;
      elInputUser.value = state.meta.userName || "";
      elResumeModNum.textContent =
        state.meta.currentModule === SCORECARD_SENTINEL ? "Scorecard" : state.meta.currentModule;
      elResumePrompt.classList.remove("hidden");
    }
    updateSaveStatus();
    showPage("landing");
  }

  init();
})();
