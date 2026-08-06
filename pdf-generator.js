// pdf-generator.js — Client-side PDF generation for The Investor's Lens
// Uses jsPDF and jsPDF-AutoTable, loaded on demand from CDN.
//
// NOTE: jsPDF's built-in fonts only cover Windows-1252 (Latin), so every string
// goes through safeText() and special symbols are drawn as shapes, not text.
//
// Security: each CDN URL is pinned with a Subresource Integrity hash and loaded
// with crossorigin="anonymous". A tampered or substituted file is rejected by
// the browser rather than executed, and the loader falls through to the next
// mirror. The hashes below correspond to jspdf@2.5.2 and jspdf-autotable@3.8.4;
// they must be recomputed if those versions change.

(function () {
  "use strict";

  // ── Library sources (url + integrity) ────────────────

  var JSPDF_SOURCES = [
    {
      url: "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
      integrity: "sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/"
    },
    {
      url: "https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js",
      integrity: "sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/"
    }
  ];

  var AUTOTABLE_SOURCES = [
    {
      url: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js",
      integrity: "sha384-Xl/CUCfJbzsngMp0CFxkmF0VW/8C160IsGujqeQlIhaGxKz2+JsIGORFqtCPeldF"
    },
    {
      url: "https://unpkg.com/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js",
      integrity: "sha384-Xl/CUCfJbzsngMp0CFxkmF0VW/8C160IsGujqeQlIhaGxKz2+JsIGORFqtCPeldF"
    },
    {
      url: "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js",
      integrity: "sha384-Xl/CUCfJbzsngMp0CFxkmF0VW/8C160IsGujqeQlIhaGxKz2+JsIGORFqtCPeldF"
    }
  ];

  function notify(msg, isError) {
    if (typeof window.ILNotify === "function") window.ILNotify(msg, isError);
    else if (isError) window.alert(msg);
  }

  function loadScript(sources) {
    return new Promise(function (resolve, reject) {
      var index = 0;
      function tryNext() {
        if (index >= sources.length) {
          reject(new Error("Could not load the PDF library from any available source."));
          return;
        }
        var source = sources[index];
        index++;
        var s = document.createElement("script");
        s.src = source.url;
        s.integrity = source.integrity;
        s.crossOrigin = "anonymous";
        s.referrerPolicy = "no-referrer";
        s.onload = function () { resolve(); };
        s.onerror = function () {
          // Covers network failure and integrity mismatch alike.
          s.remove();
          tryNext();
        };
        document.head.appendChild(s);
      }
      tryNext();
    });
  }

  function ensureLibraries() {
    if (window.jspdf && window.jspdf.jsPDF) {
      var existing = new window.jspdf.jsPDF();
      if (typeof existing.autoTable === "function") return Promise.resolve();
      return loadScript(AUTOTABLE_SOURCES);
    }

    return loadScript(JSPDF_SOURCES)
      .then(function () {
        if (!window.jspdf || !window.jspdf.jsPDF) {
          throw new Error("jsPDF loaded but window.jspdf.jsPDF was not found.");
        }
        return loadScript(AUTOTABLE_SOURCES);
      })
      .then(function () {
        var testDoc = new window.jspdf.jsPDF();
        if (typeof testDoc.autoTable !== "function") {
          throw new Error("The autoTable plugin loaded but did not attach to jsPDF.");
        }
      });
  }

  // ── Color constants (RGB arrays) ─────────────────────
  var NAVY = [27, 42, 74];
  var GOLD = [196, 163, 90];
  var BLUE_LIGHT = [232, 237, 245];
  var WHITE = [255, 255, 255];
  var TEXT_DARK = [31, 41, 55];
  var TEXT_MUTED = [107, 114, 128];
  var GREEN = [5, 150, 105];
  var RED = [220, 38, 38];

  // ── Utility: safe text for jsPDF (strip non-Latin chars) ─
  function safeText(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/[‘’]/g, "'")   // smart single quotes
      .replace(/[“”]/g, '"')   // smart double quotes
      .replace(/—/g, "--")          // em dash
      .replace(/–/g, "-")           // en dash
      .replace(/…/g, "...")         // ellipsis
      .replace(/[^\x00-\xFF]/g, "");     // anything outside Latin-1
  }

  // ── PDF helpers ──────────────────────────────────────

  function setColor(doc, method, colorArr) {
    doc[method](colorArr[0], colorArr[1], colorArr[2]);
  }

  function addCoverPage(doc, state) {
    var meta = state.meta || {};
    var pw = doc.internal.pageSize.getWidth();
    var ph = doc.internal.pageSize.getHeight();

    setColor(doc, "setFillColor", NAVY);
    doc.rect(0, 0, pw, ph * 0.4, "F");

    setColor(doc, "setFillColor", GOLD);
    doc.rect(pw / 2 - 40, ph * 0.4 - 2, 80, 4, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont("helvetica", "bold");
    doc.text("The Investor's Lens", pw / 2, 70, { align: "center" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "italic");
    doc.text("S-1 Prospectus Exercise", pw / 2, 88, { align: "center" });

    var firmY = ph * 0.4 + 40;
    setColor(doc, "setTextColor", TEXT_DARK);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    var firmLines = doc.splitTextToSize(safeText(meta.firmName) || "Your Firm", pw - 50);
    doc.text(firmLines, pw / 2, firmY, { align: "center" });

    var afterFirm = firmY + firmLines.length * 9;

    if (meta.userName) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Prepared by: " + safeText(meta.userName), pw / 2, afterFirm + 10, { align: "center" });
    }

    doc.setFontSize(11);
    setColor(doc, "setTextColor", TEXT_MUTED);
    doc.text(
      new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      pw / 2, afterFirm + 30, { align: "center" }
    );

    doc.setFontSize(9);
    doc.text("Generated with The Investor's Lens -- confidential, for internal use only",
      pw / 2, ph - 30, { align: "center" });
  }

  function addTableOfContents(doc, modules) {
    doc.addPage();
    var y = 30;
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", NAVY);
    doc.text("Table of Contents", 20, y);
    y += 14;

    setColor(doc, "setDrawColor", GOLD);
    doc.setLineWidth(1);
    doc.line(20, y, 80, y);
    y += 14;

    doc.setFontSize(12);

    for (var mi = 0; mi < modules.length; mi++) {
      var mod = modules[mi];
      doc.setFont("helvetica", "bold");
      setColor(doc, "setTextColor", GOLD);
      doc.text("Module " + mod.id, 24, y);
      doc.setFont("helvetica", "normal");
      setColor(doc, "setTextColor", TEXT_DARK);
      doc.text(safeText(mod.title) + ' -- "' + safeText(mod.subtitle) + '"', 60, y);
      y += 10;
    }

    y += 2;
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", GOLD);
    doc.text("*", 26, y);
    doc.setFont("helvetica", "normal");
    setColor(doc, "setTextColor", TEXT_DARK);
    doc.text("Self-Assessment Scorecard", 60, y);
  }

  // A prefilled row label (e.g. "Total revenue") is template, not an answer, so
  // a cell only counts as user content when it differs from its prefill value.
  // Without this a skipped worksheet would print as a page of empty boxes.
  function tableHasUserContent(field, rows) {
    if (!Array.isArray(rows)) return false;
    var prefill = field.prefillRows || [];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!Array.isArray(row)) continue;
      for (var c = 0; c < row.length; c++) {
        var val = (row[c] === null || row[c] === undefined) ? "" : String(row[c]).trim();
        if (val === "") continue;
        var preRow = prefill[r];
        var preVal = (preRow && preRow[c] !== null && preRow[c] !== undefined)
          ? String(preRow[c]).trim() : "";
        if (val !== preVal) return true;
      }
    }
    return false;
  }

  function checkPageBreak(doc, y, needed) {
    var ph = doc.internal.pageSize.getHeight();
    if (y + needed > ph - 25) {
      doc.addPage();
      return 25;
    }
    return y;
  }

  function addModulePage(doc, mod, moduleData) {
    doc.addPage();
    var pw = doc.internal.pageSize.getWidth();
    var y = 25;
    var data = moduleData || {};
    var maxTextW = pw - 48;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", GOLD);
    doc.text("MODULE " + mod.id + " OF 9", 20, y);
    y += 10;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", NAVY);
    doc.text(safeText(mod.title), 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    setColor(doc, "setTextColor", TEXT_MUTED);
    doc.text('"' + safeText(mod.subtitle) + '"', 20, y);
    y += 6;

    setColor(doc, "setDrawColor", GOLD);
    doc.setLineWidth(0.5);
    doc.line(20, y, pw - 20, y);
    y += 10;

    // Investor callout box
    var calloutLines = doc.splitTextToSize(safeText(mod.callout), pw - 64);
    var calloutH = calloutLines.length * 5 + 12;
    y = checkPageBreak(doc, y, calloutH + 4);

    setColor(doc, "setFillColor", BLUE_LIGHT);
    doc.roundedRect(20, y - 4, pw - 40, calloutH, 2, 2, "F");
    setColor(doc, "setFillColor", [176, 189, 212]);
    doc.rect(20, y - 4, 2, calloutH, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    setColor(doc, "setTextColor", NAVY);
    doc.text(calloutLines, 28, y + 4);
    y += calloutH + 8;

    for (var fi = 0; fi < mod.fields.length; fi++) {
      var field = mod.fields[fi];

      if (field.type === "textarea-short" || field.type === "textarea-long") {
        y = checkPageBreak(doc, y, 24);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        setColor(doc, "setTextColor", NAVY);
        doc.text(safeText(field.id + " " + field.label), 20, y);
        y += 6;

        var rawVal = data[field.id];
        var isEmpty = (rawVal === null || rawVal === undefined || String(rawVal).trim() === "");
        var val = isEmpty ? "(not completed)" : safeText(rawVal);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        setColor(doc, "setTextColor", isEmpty ? TEXT_MUTED : TEXT_DARK);
        var lines = doc.splitTextToSize(val, maxTextW);
        for (var li = 0; li < lines.length; li++) {
          y = checkPageBreak(doc, y, 6);
          doc.text(lines[li], 24, y);
          y += 5;
        }
        y += 6;

      } else if (field.type === "table") {
        y = checkPageBreak(doc, y, 30);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        setColor(doc, "setTextColor", NAVY);
        doc.text(safeText(field.id + " " + field.label), 20, y);
        y += 4;

        var tableRows = data[field.id];
        if (!Array.isArray(tableRows)) tableRows = [];

        // Keep only rows with at least one non-empty cell, but treat a table
        // the user never touched as unanswered rather than printing its
        // blank template.
        var filteredRows = [];
        if (tableHasUserContent(field, tableRows)) {
          for (var ri = 0; ri < tableRows.length; ri++) {
            var row = tableRows[ri];
            if (!Array.isArray(row)) continue;
            var hasContent = false;
            var safeRow = [];
            for (var ci = 0; ci < row.length; ci++) {
              var cellVal = (row[ci] !== null && row[ci] !== undefined) ? String(row[ci]) : "";
              safeRow.push(safeText(cellVal));
              if (cellVal.trim() !== "") hasContent = true;
            }
            if (hasContent) filteredRows.push(safeRow);
          }
        }

        if (filteredRows.length > 0) {
          try {
            doc.autoTable({
              startY: y,
              head: [field.columns.map(function (c) { return safeText(c); })],
              body: filteredRows,
              margin: { left: 20, right: 20 },
              styles: {
                fontSize: 9,
                cellPadding: 3,
                font: "helvetica",
                textColor: TEXT_DARK,
                lineColor: [200, 200, 200],
                lineWidth: 0.25,
                overflow: "linebreak"
              },
              headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
              alternateRowStyles: { fillColor: [248, 249, 250] }
            });
            y = doc.lastAutoTable.finalY + 10;
          } catch (e) {
            y += 6;
            doc.setFontSize(9);
            doc.setFont("helvetica", "italic");
            setColor(doc, "setTextColor", TEXT_MUTED);
            doc.text("(table could not be rendered)", 24, y);
            y += 10;
          }
        } else {
          y += 6;
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          setColor(doc, "setTextColor", TEXT_MUTED);
          doc.text("(not completed)", 24, y);
          y += 10;
        }

      } else if (field.type === "checklist") {
        y = checkPageBreak(doc, y, 16);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        setColor(doc, "setTextColor", NAVY);
        doc.text(safeText(field.id + " " + field.label), 20, y);
        y += 7;

        var checkData = data[field.id] || {};
        for (var idx = 0; idx < field.items.length; idx++) {
          y = checkPageBreak(doc, y, 7);

          if (checkData[idx]) {
            setColor(doc, "setFillColor", NAVY);
            doc.rect(24, y - 3, 3.5, 3.5, "F");
            doc.setLineWidth(0.4);
            setColor(doc, "setDrawColor", WHITE);
            doc.line(24.5, y - 2.5, 27, y);
            doc.line(27, y - 2.5, 24.5, y);
          } else {
            setColor(doc, "setDrawColor", TEXT_MUTED);
            doc.setLineWidth(0.3);
            doc.rect(24, y - 3, 3.5, 3.5, "S");
          }

          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          setColor(doc, "setTextColor", TEXT_DARK);
          doc.text(safeText(field.items[idx]), 30, y);
          y += 5.5;
        }

        if (field.hasOther && checkData.other) {
          y = checkPageBreak(doc, y, 7);
          setColor(doc, "setFillColor", NAVY);
          doc.rect(24, y - 3, 3.5, 3.5, "F");
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          setColor(doc, "setTextColor", TEXT_DARK);
          doc.text("Other: " + safeText(checkData.otherText || ""), 30, y);
          y += 5.5;
        }
        y += 6;
      }
    }
  }

  function addScorecardPage(doc, scorecard, dimensions) {
    doc.addPage();
    var pw = doc.internal.pageSize.getWidth();
    var y = 30;
    var maxScore = dimensions.length * 5;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", NAVY);
    doc.text("Self-Assessment Scorecard", 20, y);
    y += 14;

    var ratings = (scorecard && scorecard.ratings) ? scorecard.ratings : {};
    var total = 0;
    for (var di0 = 0; di0 < dimensions.length; di0++) {
      total += parseInt(ratings[dimensions[di0].id], 10) || 0;
    }

    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", GOLD);
    doc.text(total + " / " + maxScore, pw / 2, y, { align: "center" });
    y += 18;

    var barLeft = 80;
    var barMaxW = pw - barLeft - 40;
    var barH = 6;

    for (var di = 0; di < dimensions.length; di++) {
      var dim = dimensions[di];
      var val = parseInt(ratings[dim.id], 10) || 0;

      y = checkPageBreak(doc, y, 14);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      setColor(doc, "setTextColor", TEXT_DARK);
      doc.text(dim.id + ". " + safeText(dim.label), 20, y);

      setColor(doc, "setFillColor", BLUE_LIGHT);
      doc.rect(barLeft, y - 4, barMaxW, barH, "F");

      if (val > 0) {
        if (val >= 4) setColor(doc, "setFillColor", GREEN);
        else if (val >= 3) setColor(doc, "setFillColor", GOLD);
        else setColor(doc, "setFillColor", RED);
        doc.rect(barLeft, y - 4, (val / 5) * barMaxW, barH, "F");
      }

      doc.setFont("helvetica", "bold");
      setColor(doc, "setTextColor", NAVY);
      doc.text(val > 0 ? val + "/5" : "--", barLeft + barMaxW + 4, y);

      y += 12;
    }

    y += 4;
    y = checkPageBreak(doc, y, 30);

    var tableBody = [];
    for (var ti = 0; ti < dimensions.length; ti++) {
      var d = dimensions[ti];
      var v = parseInt(ratings[d.id], 10) || 0;
      var dots = "";
      for (var si = 0; si < 5; si++) dots += si < v ? "#" : ".";
      tableBody.push([d.id + ".", safeText(d.label), dots + "  " + v + "/5"]);
    }

    try {
      doc.autoTable({
        startY: y,
        head: [["#", "Dimension", "Score"]],
        body: tableBody,
        margin: { left: 20, right: 20 },
        styles: { fontSize: 10, cellPadding: 4, font: "helvetica", textColor: TEXT_DARK },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 45, font: "courier" } }
      });
      y = doc.lastAutoTable.finalY + 14;
    } catch (e) {
      y += 20;
    }

    // Reflections
    var reflections = [
      ["3 Most Important Learnings:", scorecard && scorecard.reflection1],
      ["3 Most Urgent Actions (Next 90 Days):", scorecard && scorecard.reflection2]
    ];

    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", NAVY);
    doc.text("Reflections", 20, y);
    y += 10;

    for (var r = 0; r < reflections.length; r++) {
      y = checkPageBreak(doc, y, 20);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      setColor(doc, "setTextColor", NAVY);
      doc.text(reflections[r][0], 20, y);
      y += 7;

      var raw = reflections[r][1];
      var empty = (raw === null || raw === undefined || String(raw).trim() === "");
      var text = empty ? "(not completed)" : safeText(raw);
      doc.setFont("helvetica", "normal");
      setColor(doc, "setTextColor", empty ? TEXT_MUTED : TEXT_DARK);
      var lines = doc.splitTextToSize(text, pw - 50);
      for (var li2 = 0; li2 < lines.length; li2++) {
        y = checkPageBreak(doc, y, 6);
        doc.text(lines[li2], 24, y);
        y += 5;
      }
      y += 8;
    }
  }

  // Footer + page numbers on every page except the cover.
  function addPageFooters(doc, state) {
    var meta = state.meta || {};
    var pageCount = doc.internal.getNumberOfPages();
    var pw = doc.internal.pageSize.getWidth();
    var ph = doc.internal.pageSize.getHeight();
    var firm = safeText(meta.firmName);

    for (var p = 2; p <= pageCount; p++) {
      doc.setPage(p);
      setColor(doc, "setDrawColor", [225, 228, 233]);
      doc.setLineWidth(0.3);
      doc.line(20, ph - 16, pw - 20, ph - 16);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      setColor(doc, "setTextColor", TEXT_MUTED);
      if (firm) doc.text(firm, 20, ph - 11);
      doc.text("Page " + (p - 1) + " of " + (pageCount - 1), pw - 20, ph - 11, { align: "right" });
    }
  }

  // ── Main export function (global) ────────────────────

  window.generatePDF = function (state, modules, dimensions) {
    var btn = document.getElementById("btn-generate-pdf");
    var originalText = btn ? btn.textContent : "";

    if (btn) {
      btn.textContent = "Generating PDF...";
      btn.disabled = true;
    }

    function restoreButton() {
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }

    ensureLibraries()
      .then(function () {
        var doc = new window.jspdf.jsPDF({ unit: "mm", format: "letter" });

        addCoverPage(doc, state);
        addTableOfContents(doc, modules);

        for (var i = 0; i < modules.length; i++) {
          var modData = state.modules ? state.modules[modules[i].id] : undefined;
          addModulePage(doc, modules[i], modData);
        }

        var scorecard = state.scorecard || { ratings: {}, reflection1: "", reflection2: "" };
        addScorecardPage(doc, scorecard, dimensions);
        addPageFooters(doc, state);

        var meta = state.meta || {};
        var filename = String(meta.firmName || "firm")
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || "firm";
        doc.save(filename + "_Prospectus.pdf");

        restoreButton();
        notify("Your prospectus PDF has been downloaded.");
      })
      .catch(function (err) {
        restoreButton();
        console.error("PDF generation failed:", err);
        notify(
          "Could not generate the PDF: " + (err && err.message ? err.message : "unknown error") +
          ". Your answers are still saved — check your connection and try again.",
          true
        );
      });
  };
})();
