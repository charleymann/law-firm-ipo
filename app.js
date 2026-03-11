// app.js — Main application logic for The Investor's Lens
// Handles navigation, rendering, localStorage persistence, and scorecard.

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────
  const STORAGE_KEY = "investorsLens";
  const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

  // ── State ──────────────────────────────────────────────
  let state = {
    meta: { firmName: "", userName: "", lastSaved: null, currentModule: 0 },
    modules: {},
    scorecard: { ratings: {}, reflection1: "", reflection2: "" }
  };

  // Current view: "landing", "module", "scorecard"
  let currentView = "landing";
  let currentModuleIndex = 0; // 0-indexed into MODULES array

  // ── DOM References ─────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const elHeader       = $("#app-header");
  const elSidebar      = $("#sidebar");
  const elSidebarList  = $("#sidebar-list");
  const elSidebarInner = $("#sidebar-inner");
  const elMain         = $("#main-content");
  const elBottomNav    = $("#bottom-nav");
  const elProgressFill = $("#progress-fill");
  const elToast        = $("#toast");

  // Landing
  const elPageLanding  = $("#page-landing");
  const elInputFirm    = $("#input-firm-name");
  const elInputUser    = $("#input-user-name");
  const elBtnBegin     = $("#btn-begin");
  const elResumePrompt = $("#resume-prompt");
  const elResumeModNum = $("#resume-module-num");
  const elBtnResume    = $("#btn-resume");

  // Module
  const elPageModule   = $("#page-module");
  const elModContainer = $("#module-container");

  // Scorecard
  const elPageScorecard   = $("#page-scorecard");
  const elScoreContainer  = $("#scorecard-container");

  // Nav buttons
  const elBtnBack       = $("#btn-back");
  const elBtnNext       = $("#btn-next");
  const elBtnSaveHeader = $("#btn-save-header");
  const elBtnSaveBottom = $("#btn-save-bottom");
  const elBtnStartOver  = $("#btn-start-over");
  const elSidebarToggle = $("#sidebar-toggle");
  const elFirmNameHeader = $("#header-firm-name");

  // ── Utilities ──────────────────────────────────────────

  function showToast(msg) {
    elToast.textContent = msg;
    elToast.classList.remove("hidden");
    elToast.classList.add("show");
    setTimeout(() => { elToast.classList.remove("show"); }, 2000);
    setTimeout(() => { elToast.classList.add("hidden"); }, 2300);
  }

  // ── localStorage ───────────────────────────────────────

  function saveState() {
    state.meta.lastSaved = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge into state preserving structure
        state.meta = Object.assign(state.meta, parsed.meta || {});
        state.modules = parsed.modules || {};
        state.scorecard = Object.assign(state.scorecard, parsed.scorecard || {});
        return true;
      }
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
    }
    return false;
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
    state = {
      meta: { firmName: "", userName: "", lastSaved: null, currentModule: 0 },
      modules: {},
      scorecard: { ratings: {}, reflection1: "", reflection2: "" }
    };
  }

  // ── Collect current form data from the DOM ─────────────

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
          const rows = tableEl.querySelectorAll("tbody tr");
          const tableData = [];
          rows.forEach((tr) => {
            const cells = [];
            tr.querySelectorAll("input").forEach((inp) => cells.push(inp.value));
            tableData.push(cells);
          });
          data[field.id] = tableData;
        }
      } else if (field.type === "checklist") {
        const checks = {};
        field.items.forEach((item, i) => {
          const cb = document.getElementById("check-" + field.id + "-" + i);
          if (cb) checks[i] = cb.checked;
        });
        if (field.hasOther) {
          const otherCb = document.getElementById("check-" + field.id + "-other");
          const otherInput = document.getElementById("check-" + field.id + "-other-text");
          if (otherCb) checks["other"] = otherCb.checked;
          if (otherInput) checks["otherText"] = otherInput.value;
        }
        data[field.id] = checks;
      }
    });

    state.modules[moduleId] = data;
  }

  function collectScorecardData() {
    SCORECARD_DIMENSIONS.forEach((dim) => {
      const selected = document.querySelector('input[name="score-' + dim.id + '"]:checked');
      if (selected) state.scorecard.ratings[dim.id] = parseInt(selected.value);
    });
    const r1 = document.getElementById("reflection1");
    const r2 = document.getElementById("reflection2");
    if (r1) state.scorecard.reflection1 = r1.value;
    if (r2) state.scorecard.reflection2 = r2.value;
  }

  function collectCurrentPageData() {
    if (currentView === "module") {
      collectModuleData(MODULES[currentModuleIndex].id);
    } else if (currentView === "scorecard") {
      collectScorecardData();
    }
  }

  // ── Render Helpers ─────────────────────────────────────

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderTextarea(field, savedValue) {
    const cls = field.type === "textarea-short" ? "short" : "long";
    const val = savedValue || "";
    return '<div class="form-field">' +
      '<label for="field-' + field.id + '">' + escapeHtml(field.id + " " + field.label) + '</label>' +
      (field.hint ? '<span class="field-hint">' + escapeHtml(field.hint) + '</span>' : '') +
      '<textarea id="field-' + field.id + '" class="' + cls + '" ' +
      'aria-label="' + escapeHtml(field.label) + '">' + escapeHtml(val) + '</textarea>' +
      '</div>';
  }

  function renderTable(field, savedData) {
    let html = '<div class="form-field">' +
      '<span class="field-label">' + escapeHtml(field.id + " " + field.label) + '</span>' +
      '<div class="table-wrapper">' +
      '<table class="data-table" id="table-' + field.id + '">' +
      '<thead><tr>';

    field.columns.forEach((col) => {
      html += '<th>' + escapeHtml(col) + '</th>';
    });
    html += '</tr></thead><tbody>';

    const rows = savedData || field.prefillRows;
    rows.forEach((row, ri) => {
      html += '<tr>';
      row.forEach((cell, ci) => {
        const inputId = 'cell-' + field.id + '-' + ri + '-' + ci;
        html += '<td><input type="text" id="' + inputId + '" value="' + escapeHtml(cell) + '" ' +
          'aria-label="' + escapeHtml(field.columns[ci]) + ' row ' + (ri + 1) + '"></td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>' +
      '<div class="table-actions">' +
      '<button class="btn btn-outline btn-sm" data-table-add="' + field.id + '">+ Add Row</button>' +
      '</div></div>';
    return html;
  }

  function renderChecklist(field, savedData) {
    const data = savedData || {};
    let html = '<div class="form-field">' +
      '<span class="field-label">' + escapeHtml(field.id + " " + field.label) + '</span>' +
      '<ul class="checklist">';

    field.items.forEach((item, i) => {
      const checked = data[i] ? ' checked' : '';
      html += '<li>' +
        '<input type="checkbox" id="check-' + field.id + '-' + i + '"' + checked + ' ' +
        'aria-label="' + escapeHtml(item) + '">' +
        '<label for="check-' + field.id + '-' + i + '">' + escapeHtml(item) + '</label>' +
        '</li>';
    });

    if (field.hasOther) {
      const otherChecked = data["other"] ? ' checked' : '';
      const otherText = data["otherText"] || '';
      html += '<li>' +
        '<input type="checkbox" id="check-' + field.id + '-other"' + otherChecked + ' aria-label="Other">' +
        '<label for="check-' + field.id + '-other">Other:</label>' +
        '<input type="text" class="other-input" id="check-' + field.id + '-other-text" ' +
        'value="' + escapeHtml(otherText) + '" placeholder="Describe..." aria-label="Other risk">' +
        '</li>';
    }

    html += '</ul></div>';
    return html;
  }

  // ── Render Module Page ─────────────────────────────────

  function renderModule(index) {
    const mod = MODULES[index];
    const saved = state.modules[mod.id] || {};

    let html = '<span class="module-number">Module ' + mod.id + ' of 9</span>' +
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

    // Attach table "add row" listeners
    elModContainer.querySelectorAll("[data-table-add]").forEach((btn) => {
      btn.addEventListener("click", function () {
        const fieldId = this.getAttribute("data-table-add");
        const field = mod.fields.find((f) => f.id === fieldId);
        if (!field) return;
        const tableEl = document.getElementById("table-" + fieldId);
        const tbody = tableEl.querySelector("tbody");
        const rowCount = tbody.rows.length;
        const tr = document.createElement("tr");
        field.columns.forEach((col, ci) => {
          const td = document.createElement("td");
          const input = document.createElement("input");
          input.type = "text";
          input.id = 'cell-' + fieldId + '-' + rowCount + '-' + ci;
          input.setAttribute("aria-label", col + " row " + (rowCount + 1));
          td.appendChild(input);
          tr.appendChild(td);
          // Attach blur save
          input.addEventListener("blur", function () { collectModuleData(mod.id); saveState(); });
        });
        tbody.appendChild(tr);
      });
    });

    // Attach blur save to all inputs/textareas
    elModContainer.querySelectorAll("textarea, input").forEach((el) => {
      el.addEventListener("blur", function () { collectModuleData(mod.id); saveState(); });
    });
  }

  // ── Render Scorecard ───────────────────────────────────

  function renderScorecard() {
    const ratings = state.scorecard.ratings || {};
    let total = 0;
    Object.values(ratings).forEach((v) => { total += v; });

    let html = '<div class="scorecard-header">' +
      '<span class="module-number">Self-Assessment</span>' +
      '<h2 class="module-title">Investor-Readiness Scorecard</h2>' +
      '<p class="module-subtitle">"How would an investor grade your firm?"</p>' +
      '<hr class="module-rule">' +
      '<div class="scorecard-total" id="scorecard-total">' + total + '<span class="scorecard-total-label"> / 50</span></div>' +
      '</div>';

    // Chart canvas
    html += '<div class="chart-container"><canvas id="scorecard-chart"></canvas></div>';

    // Rating dimensions
    SCORECARD_DIMENSIONS.forEach((dim) => {
      const val = ratings[dim.id] || 0;
      html += '<div class="score-dimension">' +
        '<div class="score-dim-header">' +
        '<span class="score-dim-label">' + dim.id + '. ' + escapeHtml(dim.label) + '</span>' +
        '<span class="score-dim-value" id="dim-val-' + dim.id + '">' + (val || '—') + '</span>' +
        '</div>' +
        '<p class="score-dim-desc">' + escapeHtml(dim.description) + '</p>' +
        '<div class="score-radio-group">';

      for (let i = 1; i <= 5; i++) {
        const checked = val === i ? ' checked' : '';
        const selected = val === i ? ' selected' : '';
        html += '<label class="' + (val === i ? 'selected' : '') + '">' +
          '<input type="radio" name="score-' + dim.id + '" value="' + i + '"' + checked + '>' +
          '<span>' + i + '</span></label>';
      }
      html += '</div></div>';
    });

    // Reflections
    html += '<div class="reflection-section">' +
      '<div class="form-field">' +
      '<label for="reflection1">What are the 3 most important things you learned from this exercise?</label>' +
      '<textarea id="reflection1" class="long" aria-label="Key learnings">' + escapeHtml(state.scorecard.reflection1 || '') + '</textarea>' +
      '</div>' +
      '<div class="form-field">' +
      '<label for="reflection2">What are the 3 most urgent actions you will take in the next 90 days?</label>' +
      '<textarea id="reflection2" class="long" aria-label="Action items">' + escapeHtml(state.scorecard.reflection2 || '') + '</textarea>' +
      '</div>' +
      '</div>';

    // PDF button
    html += '<div class="pdf-section">' +
      '<button id="btn-generate-pdf" class="btn btn-gold btn-lg">Generate My Prospectus (PDF)</button>' +
      '</div>';

    elScoreContainer.innerHTML = html;

    // Attach radio listeners
    elScoreContainer.querySelectorAll('.score-radio-group input[type="radio"]').forEach((radio) => {
      radio.addEventListener("change", function () {
        const dimId = this.name.replace("score-", "");
        const val = parseInt(this.value);
        state.scorecard.ratings[dimId] = val;

        // Update selected style
        const group = this.closest(".score-radio-group");
        group.querySelectorAll("label").forEach((l) => l.classList.remove("selected"));
        this.closest("label").classList.add("selected");

        // Update dimension value display
        const dimValEl = document.getElementById("dim-val-" + dimId);
        if (dimValEl) dimValEl.textContent = val;

        // Recalculate total
        let newTotal = 0;
        Object.values(state.scorecard.ratings).forEach((v) => { newTotal += v; });
        document.getElementById("scorecard-total").innerHTML = newTotal + '<span class="scorecard-total-label"> / 50</span>';

        saveState();
        drawChart();
      });
    });

    // Attach blur on reflections
    const r1 = document.getElementById("reflection1");
    const r2 = document.getElementById("reflection2");
    if (r1) r1.addEventListener("blur", function () { state.scorecard.reflection1 = this.value; saveState(); });
    if (r2) r2.addEventListener("blur", function () { state.scorecard.reflection2 = this.value; saveState(); });

    // PDF button
    document.getElementById("btn-generate-pdf").addEventListener("click", function () {
      collectScorecardData();
      saveState();
      if (typeof generatePDF === "function") {
        generatePDF(state, MODULES, SCORECARD_DIMENSIONS);
      } else {
        showToast("PDF generator not loaded.");
      }
    });

    // Draw chart
    drawChart();
  }

  // Polyfill for roundRect on older browsers
  function drawRoundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }
  }

  function drawChart() {
    const canvas = document.getElementById("scorecard-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = 480;
    const H = 300;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const ratings = state.scorecard.ratings || {};
    const dims = SCORECARD_DIMENSIONS;
    const barH = 22;
    const gap = 6;
    const labelW = 160;
    const barMaxW = W - labelW - 60;
    const startY = 10;

    dims.forEach((dim, i) => {
      const y = startY + i * (barH + gap);
      const val = ratings[dim.id] || 0;

      // Label
      ctx.fillStyle = "#1B2A4A";
      ctx.font = "12px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(dim.label, labelW - 10, y + barH / 2);

      // Background bar
      ctx.fillStyle = "#E8EDF5";
      ctx.beginPath();
      drawRoundRect(ctx, labelW, y, barMaxW, barH, 4);
      ctx.fill();

      // Filled bar
      if (val > 0) {
        const fillW = (val / 5) * barMaxW;
        ctx.fillStyle = val >= 4 ? "#059669" : val >= 3 ? "#C4A35A" : "#DC2626";
        ctx.beginPath();
        drawRoundRect(ctx, labelW, y, fillW, barH, 4);
        ctx.fill();
      }

      // Value text
      ctx.fillStyle = "#1B2A4A";
      ctx.font = "bold 12px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(val > 0 ? val + "/5" : "\u2014", labelW + barMaxW + 8, y + barH / 2);
    });
  }

  // ── Navigation ─────────────────────────────────────────

  function showPage(view, moduleIdx) {
    // Save current data before navigating away
    collectCurrentPageData();

    currentView = view;
    elPageLanding.classList.add("hidden");
    elPageModule.classList.add("hidden");
    elPageScorecard.classList.add("hidden");

    if (view === "landing") {
      elPageLanding.classList.remove("hidden");
      elHeader.classList.add("hidden");
      elSidebar.classList.add("hidden");
      elBottomNav.classList.add("hidden");
      return;
    }

    // Show chrome
    elHeader.classList.remove("hidden");
    elSidebar.classList.remove("hidden");
    elBottomNav.classList.remove("hidden");
    elFirmNameHeader.textContent = state.meta.firmName || "";

    if (view === "module") {
      currentModuleIndex = moduleIdx;
      state.meta.currentModule = MODULES[moduleIdx].id;
      elPageModule.classList.remove("hidden");
      renderModule(moduleIdx);
      // Scroll to top of module
      elPageModule.scrollIntoView({ behavior: "smooth" });
      window.scrollTo(0, 0);
    } else if (view === "scorecard") {
      state.meta.currentModule = 10; // sentinel for scorecard
      elPageScorecard.classList.remove("hidden");
      renderScorecard();
      window.scrollTo(0, 0);
    }

    updateSidebar();
    updateProgressBar();
    updateNavButtons();
    saveState();
  }

  function updateProgressBar() {
    // Total steps = 9 modules + 1 scorecard = 10
    let step = 0;
    if (currentView === "module") step = currentModuleIndex + 1;
    else if (currentView === "scorecard") step = 10;
    const pct = (step / 10) * 100;
    elProgressFill.style.width = pct + "%";
  }

  function updateNavButtons() {
    if (currentView === "module") {
      elBtnBack.disabled = currentModuleIndex === 0;
      elBtnNext.textContent = currentModuleIndex === MODULES.length - 1 ? "Scorecard \u2192" : "Next Module \u2192";
    } else if (currentView === "scorecard") {
      elBtnBack.disabled = false;
      elBtnNext.textContent = "Finish";
      elBtnNext.disabled = true;
    }
  }

  function updateSidebar() {
    let html = "";
    MODULES.forEach((mod, i) => {
      const active = currentView === "module" && currentModuleIndex === i ? " active" : "";
      // Check if module has any data
      const hasData = state.modules[mod.id] && Object.keys(state.modules[mod.id]).length > 0;
      html += '<li class="' + active + '" data-module="' + i + '">' +
        '<span class="mod-num">' + mod.id + '</span>' +
        '<span>' + escapeHtml(mod.title) + '</span>' +
        (hasData ? '<span class="mod-check">\u2713</span>' : '') +
        '</li>';
    });
    // Scorecard entry
    const scActive = currentView === "scorecard" ? " active" : "";
    html += '<li class="scorecard-item' + scActive + '" data-module="scorecard">' +
      '<span class="mod-num">\u2605</span>' +
      '<span>Scorecard</span></li>';

    elSidebarList.innerHTML = html;

    // Attach click listeners
    elSidebarList.querySelectorAll("li").forEach((li) => {
      li.addEventListener("click", function () {
        const idx = this.getAttribute("data-module");
        if (idx === "scorecard") {
          showPage("scorecard");
        } else {
          showPage("module", parseInt(idx));
        }
        // Close sidebar on mobile
        elSidebar.classList.remove("open");
      });
    });
  }

  // ── Event Handlers ─────────────────────────────────────

  elBtnBegin.addEventListener("click", function () {
    const firm = elInputFirm.value.trim();
    const user = elInputUser.value.trim();
    if (!firm) { elInputFirm.focus(); return; }
    state.meta.firmName = firm;
    state.meta.userName = user;
    saveState();
    showPage("module", 0);
  });

  elBtnResume.addEventListener("click", function () {
    const modId = state.meta.currentModule;
    if (modId === 10) {
      showPage("scorecard");
    } else {
      const idx = MODULES.findIndex((m) => m.id === modId);
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
      if (currentModuleIndex < MODULES.length - 1) {
        showPage("module", currentModuleIndex + 1);
      } else {
        showPage("scorecard");
      }
    }
  });

  function handleSave() {
    collectCurrentPageData();
    saveState();
    showToast("Progress saved.");
  }

  elBtnSaveHeader.addEventListener("click", handleSave);
  elBtnSaveBottom.addEventListener("click", handleSave);

  elBtnStartOver.addEventListener("click", function () {
    if (confirm("Are you sure you want to start over? All your data will be permanently erased.")) {
      clearState();
      showPage("landing");
      elInputFirm.value = "";
      elInputUser.value = "";
      elResumePrompt.classList.add("hidden");
      showToast("All data cleared.");
    }
  });

  elSidebarToggle.addEventListener("click", function () {
    elSidebar.classList.toggle("open");
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", function (e) {
    if (elSidebar.classList.contains("open") &&
        !elSidebar.contains(e.target) &&
        e.target !== elSidebarToggle) {
      elSidebar.classList.remove("open");
    }
  });

  // Allow Enter key on landing inputs to begin
  [elInputFirm, elInputUser].forEach(function (el) {
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter") elBtnBegin.click();
    });
  });

  // ── Auto-save timer ────────────────────────────────────
  setInterval(function () {
    if (currentView !== "landing") {
      collectCurrentPageData();
      saveState();
    }
  }, AUTO_SAVE_INTERVAL);

  // ── Initialize ─────────────────────────────────────────
  function init() {
    const hasSaved = loadState();
    if (hasSaved && state.meta.firmName) {
      elInputFirm.value = state.meta.firmName;
      elInputUser.value = state.meta.userName || "";
      elResumeModNum.textContent = state.meta.currentModule <= 9 ? state.meta.currentModule : "Scorecard";
      elResumePrompt.classList.remove("hidden");
    }
    // Start on landing
    showPage("landing");
  }

  init();
})();
