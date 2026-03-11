// pdf-generator.js — Client-side PDF generation for The Investor's Lens
// Uses jsPDF and jsPDF-AutoTable loaded from CDN dynamically.

(function () {
  "use strict";

  // ── Load jsPDF & AutoTable from CDN ──────────────────
  let jsPDFReady = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureLibraries() {
    if (jsPDFReady) return Promise.resolve();
    return loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js")
      .then(function () {
        return loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
      })
      .then(function () {
        jsPDFReady = true;
      });
  }

  // ── Color constants ──────────────────────────────────
  const NAVY = [27, 42, 74];
  const GOLD = [196, 163, 90];
  const BLUE_LIGHT = [232, 237, 245];
  const WHITE = [255, 255, 255];
  const TEXT_DARK = [31, 41, 55];
  const TEXT_MUTED = [107, 114, 128];

  // ── PDF helpers ──────────────────────────────────────

  function addCoverPage(doc, state) {
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Navy background bar
    doc.setFillColor.apply(doc, NAVY);
    doc.rect(0, 0, pw, ph / 2.5, "F");

    // Gold accent line
    doc.setFillColor.apply(doc, GOLD);
    doc.rect(pw / 2 - 40, ph / 2.5 - 2, 80, 4, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont("helvetica", "bold");
    doc.text("The Investor's Lens", pw / 2, 70, { align: "center" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "italic");
    doc.text("S-1 Prospectus Exercise", pw / 2, 88, { align: "center" });

    // Firm name & user
    doc.setTextColor.apply(doc, TEXT_DARK);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    var firmY = ph / 2.5 + 40;
    doc.text(state.meta.firmName || "Your Firm", pw / 2, firmY, { align: "center" });

    if (state.meta.userName) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Prepared by: " + state.meta.userName, pw / 2, firmY + 18, { align: "center" });
    }

    // Date
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, TEXT_MUTED);
    var d = new Date();
    doc.text(d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), pw / 2, firmY + 40, { align: "center" });

    // Footer text
    doc.setFontSize(9);
    doc.text("Generated with The Investor's Lens — for internal use only", pw / 2, ph - 30, { align: "center" });
  }

  function addTableOfContents(doc, modules) {
    doc.addPage();
    var y = 30;
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor.apply(doc, NAVY);
    doc.text("Table of Contents", 20, y);
    y += 16;

    doc.setDrawColor.apply(doc, GOLD);
    doc.setLineWidth(1);
    doc.line(20, y, 80, y);
    y += 16;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor.apply(doc, TEXT_DARK);

    modules.forEach(function (mod) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor.apply(doc, GOLD);
      doc.text("Module " + mod.id, 24, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor.apply(doc, TEXT_DARK);
      doc.text(mod.title + ' — "' + mod.subtitle + '"', 60, y);
      y += 10;
    });

    // Scorecard entry
    doc.setFont("helvetica", "bold");
    doc.setTextColor.apply(doc, GOLD);
    doc.text("\u2605", 24, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor.apply(doc, TEXT_DARK);
    doc.text("Self-Assessment Scorecard", 60, y);
  }

  function checkPageBreak(doc, y, needed) {
    var ph = doc.internal.pageSize.getHeight();
    if (y + needed > ph - 30) {
      doc.addPage();
      return 30;
    }
    return y;
  }

  function addModulePage(doc, mod, moduleData) {
    doc.addPage();
    var pw = doc.internal.pageSize.getWidth();
    var y = 25;

    // Module number
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor.apply(doc, GOLD);
    doc.text("MODULE " + mod.id + " OF 9", 20, y);
    y += 10;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor.apply(doc, NAVY);
    doc.text(mod.title, 20, y);
    y += 8;

    // Subtitle
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.setTextColor.apply(doc, TEXT_MUTED);
    doc.text('"' + mod.subtitle + '"', 20, y);
    y += 6;

    // Rule
    doc.setDrawColor.apply(doc, GOLD);
    doc.setLineWidth(0.5);
    doc.line(20, y, pw - 20, y);
    y += 10;

    // Investor callout
    doc.setFillColor.apply(doc, BLUE_LIGHT);
    var calloutLines = doc.splitTextToSize(mod.callout, pw - 60);
    var calloutH = calloutLines.length * 6 + 10;
    y = checkPageBreak(doc, y, calloutH + 4);
    doc.roundedRect(20, y - 4, pw - 40, calloutH, 3, 3, "F");
    doc.setDrawColor(176, 189, 212);
    doc.setLineWidth(1.5);
    doc.line(20, y - 4, 20, y - 4 + calloutH);
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor.apply(doc, NAVY);
    doc.text(calloutLines, 28, y + 4);
    y += calloutH + 10;

    // Fields
    mod.fields.forEach(function (field) {
      var data = moduleData || {};

      if (field.type === "textarea-short" || field.type === "textarea-long") {
        y = checkPageBreak(doc, y, 30);
        // Label
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor.apply(doc, NAVY);
        doc.text(field.id + " " + field.label, 20, y);
        y += 6;

        // Value
        var val = data[field.id] || "(not completed)";
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor.apply(doc, TEXT_DARK);
        var lines = doc.splitTextToSize(val, pw - 50);
        lines.forEach(function (line) {
          y = checkPageBreak(doc, y, 8);
          doc.text(line, 24, y);
          y += 5.5;
        });
        y += 6;

      } else if (field.type === "table") {
        y = checkPageBreak(doc, y, 40);
        // Label
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor.apply(doc, NAVY);
        doc.text(field.id + " " + field.label, 20, y);
        y += 4;

        var tableRows = data[field.id] || field.prefillRows;
        // Filter out empty rows
        var filteredRows = tableRows.filter(function (row) {
          return row.some(function (cell) { return cell && cell.trim() !== ""; });
        });

        if (filteredRows.length > 0) {
          doc.autoTable({
            startY: y,
            head: [field.columns],
            body: filteredRows,
            margin: { left: 20, right: 20 },
            styles: { fontSize: 9, cellPadding: 3, font: "helvetica" },
            headStyles: {
              fillColor: NAVY,
              textColor: WHITE,
              fontStyle: "bold"
            },
            alternateRowStyles: { fillColor: [248, 249, 250] },
            didDrawPage: function () {}
          });
          y = doc.lastAutoTable.finalY + 10;
        } else {
          y += 8;
          doc.setFontSize(9);
          doc.setFont("helvetica", "italic");
          doc.setTextColor.apply(doc, TEXT_MUTED);
          doc.text("(no data entered)", 24, y);
          y += 10;
        }

      } else if (field.type === "checklist") {
        y = checkPageBreak(doc, y, 20);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor.apply(doc, NAVY);
        doc.text(field.id + " " + field.label, 20, y);
        y += 7;

        var checkData = data[field.id] || {};
        field.items.forEach(function (item, i) {
          y = checkPageBreak(doc, y, 8);
          var checked = checkData[i];
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor.apply(doc, TEXT_DARK);
          doc.text((checked ? "\u2611 " : "\u2610 ") + item, 24, y);
          y += 5.5;
        });

        if (field.hasOther && checkData["other"]) {
          y = checkPageBreak(doc, y, 8);
          doc.text("\u2611 Other: " + (checkData["otherText"] || ""), 24, y);
          y += 5.5;
        }
        y += 6;
      }
    });
  }

  function addScorecardPage(doc, scorecard, dimensions) {
    doc.addPage();
    var pw = doc.internal.pageSize.getWidth();
    var y = 30;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor.apply(doc, NAVY);
    doc.text("Self-Assessment Scorecard", 20, y);
    y += 12;

    // Total
    var total = 0;
    var ratings = scorecard.ratings || {};
    Object.values(ratings).forEach(function (v) { total += v; });

    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor.apply(doc, GOLD);
    doc.text(total + " / 50", pw / 2, y, { align: "center" });
    y += 16;

    // Ratings table
    var tableBody = dimensions.map(function (dim) {
      var val = ratings[dim.id] || 0;
      var bar = "";
      for (var i = 0; i < 5; i++) bar += i < val ? "\u2588" : "\u2591";
      return [dim.id + ".", dim.label, bar + " " + val + "/5"];
    });

    doc.autoTable({
      startY: y,
      head: [["#", "Dimension", "Score"]],
      body: tableBody,
      margin: { left: 20, right: 20 },
      styles: { fontSize: 10, cellPadding: 4, font: "helvetica" },
      headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 15 },
        2: { cellWidth: 50, font: "courier" }
      }
    });
    y = doc.lastAutoTable.finalY + 14;

    // Reflections
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor.apply(doc, NAVY);
    doc.text("Reflections", 20, y);
    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("3 Most Important Learnings:", 20, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setTextColor.apply(doc, TEXT_DARK);
    var r1 = scorecard.reflection1 || "(not completed)";
    var r1Lines = doc.splitTextToSize(r1, pw - 50);
    r1Lines.forEach(function (line) {
      y = checkPageBreak(doc, y, 8);
      doc.text(line, 24, y);
      y += 5.5;
    });
    y += 8;

    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor.apply(doc, NAVY);
    doc.text("3 Most Urgent Actions (Next 90 Days):", 20, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setTextColor.apply(doc, TEXT_DARK);
    var r2 = scorecard.reflection2 || "(not completed)";
    var r2Lines = doc.splitTextToSize(r2, pw - 50);
    r2Lines.forEach(function (line) {
      y = checkPageBreak(doc, y, 8);
      doc.text(line, 24, y);
      y += 5.5;
    });
  }

  // ── Main export function (global) ────────────────────

  window.generatePDF = function (state, modules, dimensions) {
    ensureLibraries()
      .then(function () {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ unit: "mm", format: "letter" });

        // Cover page
        addCoverPage(doc, state);

        // Table of contents
        addTableOfContents(doc, modules);

        // Module pages
        modules.forEach(function (mod) {
          addModulePage(doc, mod, state.modules[mod.id]);
        });

        // Scorecard
        addScorecardPage(doc, state.scorecard, dimensions);

        // Save
        var filename = (state.meta.firmName || "firm").replace(/[^a-zA-Z0-9]/g, "_");
        doc.save(filename + "_Prospectus.pdf");
      })
      .catch(function (err) {
        console.error("PDF generation failed:", err);
        alert("Could not generate PDF. Please check your internet connection (required for first-time library download) and try again.");
      });
  };
})();
