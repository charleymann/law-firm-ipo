// pdf-generator.js — Client-side PDF generation for The Investor's Lens
// Uses jsPDF and jsPDF-AutoTable loaded from CDN dynamically.
// NOTE: jsPDF built-in fonts only support Windows-1252 (Latin) characters.
// All special symbols are drawn as shapes, not text.

(function () {
  "use strict";

  // ── Load jsPDF & AutoTable from CDN ──────────────────
  // Use multiple CDN sources for reliability.

  function loadScript(urls) {
    // Try each URL in sequence until one works
    return new Promise(function (resolve, reject) {
      var index = 0;
      function tryNext() {
        if (index >= urls.length) {
          reject(new Error("Failed to load library from all CDN sources: " + urls.join(", ")));
          return;
        }
        var src = urls[index];
        index++;
        var s = document.createElement("script");
        s.src = src;
        s.onload = function () { resolve(); };
        s.onerror = function () {
          // Remove failed script tag so it doesn't interfere with retries
          s.remove();
          tryNext();
        };
        document.head.appendChild(s);
      }
      tryNext();
    });
  }

  function ensureLibraries() {
    // If already loaded, skip
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve();

    var jspdfUrls = [
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      "https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js"
    ];

    var autotableUrls = [
      "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js",
      "https://unpkg.com/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js"
    ];

    return loadScript(jspdfUrls)
      .then(function () {
        if (!window.jspdf || !window.jspdf.jsPDF) {
          throw new Error("jsPDF loaded but window.jspdf.jsPDF not found");
        }
        return loadScript(autotableUrls);
      })
      .then(function () {
        // Verify autoTable is available
        var testDoc = new window.jspdf.jsPDF();
        if (typeof testDoc.autoTable !== "function") {
          throw new Error("autoTable plugin loaded but not attached to jsPDF");
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
    var s = String(str);
    return s
      .replace(/[\u2018\u2019]/g, "'")   // smart single quotes
      .replace(/[\u201C\u201D]/g, '"')   // smart double quotes
      .replace(/\u2014/g, "--")          // em dash
      .replace(/\u2013/g, "-")           // en dash
      .replace(/\u2026/g, "...")         // ellipsis
      .replace(/[^\x00-\xFF]/g, "");     // strip anything outside Latin-1
  }

  // ── PDF helpers ──────────────────────────────────────

  function setColor(doc, method, colorArr) {
    doc[method](colorArr[0], colorArr[1], colorArr[2]);
  }

  function addCoverPage(doc, state) {
    var pw = doc.internal.pageSize.getWidth();
    var ph = doc.internal.pageSize.getHeight();

    // Navy background bar across top ~40%
    setColor(doc, "setFillColor", NAVY);
    doc.rect(0, 0, pw, ph * 0.4, "F");

    // Gold accent line
    setColor(doc, "setFillColor", GOLD);
    doc.rect(pw / 2 - 40, ph * 0.4 - 2, 80, 4, "F");

    // Title text (white on navy)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont("helvetica", "bold");
    doc.text("The Investor's Lens", pw / 2, 70, { align: "center" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "italic");
    doc.text("S-1 Prospectus Exercise", pw / 2, 88, { align: "center" });

    // Firm name & user (below navy bar)
    var firmY = ph * 0.4 + 40;
    setColor(doc, "setTextColor", TEXT_DARK);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(safeText(state.meta.firmName) || "Your Firm", pw / 2, firmY, { align: "center" });

    if (state.meta.userName) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Prepared by: " + safeText(state.meta.userName), pw / 2, firmY + 18, { align: "center" });
    }

    // Date
    doc.setFontSize(11);
    setColor(doc, "setTextColor", TEXT_MUTED);
    var d = new Date();
    doc.text(d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), pw / 2, firmY + 40, { align: "center" });

    // Footer
    doc.setFontSize(9);
    doc.text("Generated with The Investor's Lens -- for internal use only", pw / 2, ph - 30, { align: "center" });
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

    // Scorecard entry
    y += 2;
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", GOLD);
    doc.text("*", 26, y);
    doc.setFont("helvetica", "normal");
    setColor(doc, "setTextColor", TEXT_DARK);
    doc.text("Self-Assessment Scorecard", 60, y);
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

    // Module number
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", GOLD);
    doc.text("MODULE " + mod.id + " OF 9", 20, y);
    y += 10;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", NAVY);
    doc.text(safeText(mod.title), 20, y);
    y += 8;

    // Subtitle
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    setColor(doc, "setTextColor", TEXT_MUTED);
    doc.text('"' + safeText(mod.subtitle) + '"', 20, y);
    y += 6;

    // Rule
    setColor(doc, "setDrawColor", GOLD);
    doc.setLineWidth(0.5);
    doc.line(20, y, pw - 20, y);
    y += 10;

    // Investor callout box
    var calloutText = safeText(mod.callout);
    var calloutLines = doc.splitTextToSize(calloutText, pw - 64);
    var calloutH = calloutLines.length * 5 + 12;
    y = checkPageBreak(doc, y, calloutH + 4);

    setColor(doc, "setFillColor", BLUE_LIGHT);
    doc.roundedRect(20, y - 4, pw - 40, calloutH, 2, 2, "F");
    // Left accent border
    setColor(doc, "setFillColor", [176, 189, 212]);
    doc.rect(20, y - 4, 2, calloutH, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    setColor(doc, "setTextColor", NAVY);
    doc.text(calloutLines, 28, y + 4);
    y += calloutH + 8;

    // Fields
    for (var fi = 0; fi < mod.fields.length; fi++) {
      var field = mod.fields[fi];

      if (field.type === "textarea-short" || field.type === "textarea-long") {
        y = checkPageBreak(doc, y, 24);

        // Label
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        setColor(doc, "setTextColor", NAVY);
        doc.text(safeText(field.id + " " + field.label), 20, y);
        y += 6;

        // Value — show placeholder if empty
        var rawVal = data[field.id];
        var val = (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== "")
          ? safeText(rawVal)
          : "(not completed)";
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        setColor(doc, "setTextColor", val === "(not completed)" ? TEXT_MUTED : TEXT_DARK);
        var lines = doc.splitTextToSize(val, maxTextW);
        for (var li = 0; li < lines.length; li++) {
          y = checkPageBreak(doc, y, 6);
          doc.text(lines[li], 24, y);
          y += 5;
        }
        y += 6;

      } else if (field.type === "table") {
        y = checkPageBreak(doc, y, 30);

        // Label
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        setColor(doc, "setTextColor", NAVY);
        doc.text(safeText(field.id + " " + field.label), 20, y);
        y += 4;

        var tableRows = data[field.id];
        var hasSavedData = Array.isArray(tableRows) && tableRows.length > 0;

        // Use prefill rows as fallback
        if (!hasSavedData) {
          tableRows = field.prefillRows;
        }

        // Safety: ensure tableRows is a valid array
        if (!Array.isArray(tableRows)) {
          tableRows = [];
        }

        // Build safe rows, keeping rows that have at least one non-empty cell
        var filteredRows = [];
        for (var ri = 0; ri < tableRows.length; ri++) {
          var row = tableRows[ri];
          if (!Array.isArray(row)) continue;
          var hasContent = false;
          var safeRow = [];
          for (var ci = 0; ci < row.length; ci++) {
            var cellVal = (row[ci] !== null && row[ci] !== undefined) ? String(row[ci]) : "";
            safeRow.push(safeText(cellVal));
            if (cellVal.trim() !== "") {
              hasContent = true;
            }
          }
          if (hasContent) {
            filteredRows.push(safeRow);
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
                lineWidth: 0.25
              },
              headStyles: {
                fillColor: NAVY,
                textColor: WHITE,
                fontStyle: "bold"
              },
              alternateRowStyles: { fillColor: [248, 249, 250] }
            });
            y = doc.lastAutoTable.finalY + 10;
          } catch (e) {
            // Fallback if autoTable fails
            y += 6;
            doc.setFontSize(9);
            doc.setFont("helvetica", "italic");
            setColor(doc, "setTextColor", TEXT_MUTED);
            doc.text("(table could not be rendered)", 24, y);
            y += 10;
          }
        } else {
          y += 6;
          doc.setFontSize(9);
          doc.setFont("helvetica", "italic");
          setColor(doc, "setTextColor", TEXT_MUTED);
          doc.text("(no data entered)", 24, y);
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
          var checked = checkData[idx];

          // Draw checkbox as a small rectangle
          if (checked) {
            setColor(doc, "setFillColor", NAVY);
            doc.rect(24, y - 3, 3.5, 3.5, "F");
            // Checkmark lines
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

        if (field.hasOther && checkData["other"]) {
          y = checkPageBreak(doc, y, 7);
          setColor(doc, "setFillColor", NAVY);
          doc.rect(24, y - 3, 3.5, 3.5, "F");
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          setColor(doc, "setTextColor", TEXT_DARK);
          doc.text("Other: " + safeText(checkData["otherText"] || ""), 30, y);
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

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", NAVY);
    doc.text("Self-Assessment Scorecard", 20, y);
    y += 14;

    // Total score
    var total = 0;
    var ratings = (scorecard && scorecard.ratings) ? scorecard.ratings : {};
    var keys = Object.keys(ratings);
    for (var k = 0; k < keys.length; k++) {
      var ratingVal = parseInt(ratings[keys[k]]) || 0;
      total += ratingVal;
    }

    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", GOLD);
    doc.text(total + " / 50", pw / 2, y, { align: "center" });
    y += 18;

    // Draw score bars for each dimension
    var barLeft = 80;
    var barMaxW = pw - barLeft - 40;
    var barH = 6;

    for (var di = 0; di < dimensions.length; di++) {
      var dim = dimensions[di];
      var val = parseInt(ratings[dim.id]) || 0;

      y = checkPageBreak(doc, y, 14);

      // Dimension label
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      setColor(doc, "setTextColor", TEXT_DARK);
      doc.text(dim.id + ". " + safeText(dim.label), 20, y);

      // Background bar
      setColor(doc, "setFillColor", BLUE_LIGHT);
      doc.rect(barLeft, y - 4, barMaxW, barH, "F");

      // Filled bar
      if (val > 0) {
        var fillW = (val / 5) * barMaxW;
        if (val >= 4) { setColor(doc, "setFillColor", GREEN); }
        else if (val >= 3) { setColor(doc, "setFillColor", GOLD); }
        else { setColor(doc, "setFillColor", RED); }
        doc.rect(barLeft, y - 4, fillW, barH, "F");
      }

      // Score value
      doc.setFont("helvetica", "bold");
      setColor(doc, "setTextColor", NAVY);
      doc.text(val > 0 ? val + "/5" : "--", barLeft + barMaxW + 4, y);

      y += 12;
    }

    // Ratings summary table
    y += 4;
    y = checkPageBreak(doc, y, 30);

    var tableBody = [];
    for (var ti = 0; ti < dimensions.length; ti++) {
      var d = dimensions[ti];
      var v = parseInt(ratings[d.id]) || 0;
      var dots = "";
      for (var si = 0; si < 5; si++) {
        dots += si < v ? "#" : ".";
      }
      tableBody.push([d.id + ".", safeText(d.label), dots + "  " + v + "/5"]);
    }

    try {
      doc.autoTable({
        startY: y,
        head: [["#", "Dimension", "Score"]],
        body: tableBody,
        margin: { left: 20, right: 20 },
        styles: {
          fontSize: 10,
          cellPadding: 4,
          font: "helvetica",
          textColor: TEXT_DARK
        },
        headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 15 },
          2: { cellWidth: 45, font: "courier" }
        }
      });
      y = doc.lastAutoTable.finalY + 14;
    } catch (e) {
      y += 20;
    }

    // Reflections
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", NAVY);
    doc.text("Reflections", 20, y);
    y += 10;

    // Reflection 1
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("3 Most Important Learnings:", 20, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    var r1Raw = (scorecard && scorecard.reflection1) ? scorecard.reflection1 : "";
    var r1 = safeText(r1Raw);
    if (!r1 || r1.trim() === "") r1 = "(not completed)";
    setColor(doc, "setTextColor", r1 === "(not completed)" ? TEXT_MUTED : TEXT_DARK);
    var r1Lines = doc.splitTextToSize(r1, pw - 50);
    for (var r1i = 0; r1i < r1Lines.length; r1i++) {
      y = checkPageBreak(doc, y, 6);
      doc.text(r1Lines[r1i], 24, y);
      y += 5;
    }
    y += 8;

    // Reflection 2
    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    setColor(doc, "setTextColor", NAVY);
    doc.text("3 Most Urgent Actions (Next 90 Days):", 20, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    var r2Raw = (scorecard && scorecard.reflection2) ? scorecard.reflection2 : "";
    var r2 = safeText(r2Raw);
    if (!r2 || r2.trim() === "") r2 = "(not completed)";
    setColor(doc, "setTextColor", r2 === "(not completed)" ? TEXT_MUTED : TEXT_DARK);
    var r2Lines = doc.splitTextToSize(r2, pw - 50);
    for (var r2i = 0; r2i < r2Lines.length; r2i++) {
      y = checkPageBreak(doc, y, 6);
      doc.text(r2Lines[r2i], 24, y);
      y += 5;
    }
  }

  // ── Main export function (global) ────────────────────

  window.generatePDF = function (state, modules, dimensions) {
    // Show loading state
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
        try {
          var jsPDF = window.jspdf.jsPDF;
          var doc = new jsPDF({ unit: "mm", format: "letter" });

          // Cover page
          addCoverPage(doc, state);

          // Table of contents
          addTableOfContents(doc, modules);

          // Module pages
          for (var i = 0; i < modules.length; i++) {
            var modData = state.modules ? state.modules[modules[i].id] : undefined;
            addModulePage(doc, modules[i], modData);
          }

          // Scorecard
          var scorecard = state.scorecard || { ratings: {}, reflection1: "", reflection2: "" };
          addScorecardPage(doc, scorecard, dimensions);

          // Save file
          var filename = (state.meta.firmName || "firm").replace(/[^a-zA-Z0-9]/g, "_");
          doc.save(filename + "_Prospectus.pdf");

          restoreButton();
        } catch (genErr) {
          restoreButton();
          console.error("PDF generation error:", genErr);
          alert("An error occurred while generating the PDF.\n\nError: " + genErr.message + "\n\nPlease try again. If the problem persists, try using a different browser.");
        }
      })
      .catch(function (loadErr) {
        restoreButton();
        console.error("PDF library loading failed:", loadErr);
        alert("Could not load the PDF library. Please check your internet connection and try again.\n\nError: " + loadErr.message);
      });
  };
})();
