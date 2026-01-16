import express from "express";
import { supabase } from "../index.js";
import XLSX from "xlsx-js-style";

const router = express.Router();

const convertTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const hours = Number.parseInt(parts[0]) || 0;
  const minutes = Number.parseInt(parts[1]) || 0;
  const seconds = Number.parseInt(parts[2]) || 0;
  return hours * 60 + minutes + seconds / 60;
};

const DISPO_ORDER = [
  "ALREADY PAID",
  "BUSY",
  "CALL BACK",
  "INTERESTED",
  "INTRODUCTION",
  "LANGUAGE ISSUE",
  "NEED UPDATE",
  "NOT INTERESTED",
  "NOT PICKUP",
  "OTHER",
  "SCRAP",
  "UNDISPOSED",
  "VOICE ISSUE",
];

// Get row style based on disposition
const getDispoFillColor = (dispo) => {
  switch (dispo) {
    case "INTERESTED":
    case "INTRODUCTION":
      return "92D050"; // Green
    case "NOT INTERESTED":
      return "C65911"; // Orange
    default:
      return "FFFFFF"; // White
  }
};

const getDispoFontColor = (dispo) => {
  switch (dispo) {
    case "NOT INTERESTED":
      return "FFFFFF"; // White text
    default:
      return "000000"; // Black text
  }
};

router.post("/talktime-excel", async (req, res) => {
  try {
    const {
      data,
      branch,
      user_id,
      grandTotals,
      talktimeThreshold,
      reportType = "DIALER",
    } = req.body;

    if (!data || !branch || !user_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    let branchHeader = `${branch.toUpperCase()} `;
    if (reportType === "CRM") {
      branchHeader += "CRM CALL REPORT";
    } else if (reportType === "MASTER") {
      branchHeader += "MASTER CALL REPORT";
    } else {
      branchHeader += "DIALER TALK TIME REPORT";
      // Add threshold info to header if provided for DIALER report
      if (talktimeThreshold) {
        branchHeader += ` (Threshold: ${talktimeThreshold})`;
      }
    }
    worksheetData.push([branchHeader]);

    if (reportType === "MASTER") {
      // Header row 1 - Main categories
      worksheetData.push([
        "",
        "",
        "DIALER",
        "",
        "",
        "",
        "",
        "CRM",
        "",
        "GRAND TOTAL",
        "",
      ]);
      // Header row 2 - Sub categories
      worksheetData.push([
        "SR NO.",
        "NAME",
        "ANS CALLS",
        "MISSED CALLS",
        "PROSPECT",
        "TALKTIME",
        "TOTAL CALLS",
        "CALLS",
        "PROSPECT",
        "PROSPECT",
        "CALLS",
      ]);

      data.forEach((row, i) => {
        worksheetData.push([
          i + 1,
          row.NAME || "",
          row.ANS_CALLS || 0,
          row.MISSED_CALLS || 0,
          row.PROSPECT || 0,
          row.TALK_TIME || "0:00:00",
          row.TOTAL_CALLS || 0,
          row.CRM_CALLS || 0,
          row.CRM_PROSPECT || 0,
          (row.PROSPECT || 0) + (row.CRM_PROSPECT || 0),
          row.TOTAL_CALLS + (row.CRM_CALLS || 0),
        ]);
      });

      worksheetData.push([
        "GRAND TOTAL",
        "",
        grandTotals?.ansCalls || 0,
        grandTotals?.missedCalls || 0,
        grandTotals?.prospect || 0,
        grandTotals?.talkTime || "0:00:00",
        grandTotals?.totalCalls || 0,
        grandTotals?.crmCalls || 0,
        grandTotals?.crmProspect || 0,
        grandTotals?.grandProspect || 0,
        grandTotals?.grandCalls || 0,
      ]);
    } else if (reportType === "CRM") {
      worksheetData.push(["SR NO.", "NAME", "CRM CALLS", "PROSPECT", "TOTAL"]);

      data.forEach((row, i) => {
        worksheetData.push([
          i + 1,
          row.NAME || "",
          row.CRM_CALLS || row.ANS_CALLS || 0,
          row.CRM_PROSPECT || row.PROSPECT || 0,
          row.CRM_CALLS || row.TOTAL_CALLS || 0,
        ]);
      });

      worksheetData.push([
        "GRAND TOTAL",
        "",
        grandTotals?.crmCalls || grandTotals?.ansCalls || 0,
        grandTotals?.crmProspect || grandTotals?.prospect || 0,
        grandTotals?.crmCalls || grandTotals?.totalCalls || 0,
      ]);
    } else {
      // DIALER report
      worksheetData.push([
        "SR NO.",
        "NAME",
        "ANS CALLS",
        "MISSED CALLS",
        "TOTAL CALLS",
        "PROSPECT",
        "TALK TIME",
      ]);

      data.forEach((row, i) => {
        worksheetData.push([
          i + 1,
          row.NAME || "",
          row.ANS_CALLS || 0,
          row.MISSED_CALLS || 0,
          row.TOTAL_CALLS || 0,
          row.PROSPECT || 0,
          row.TALK_TIME || "",
        ]);
      });

      worksheetData.push([
        "GRAND TOTAL",
        "",
        grandTotals?.ansCalls || 0,
        grandTotals?.missedCalls || 0,
        grandTotals?.totalCalls || 0,
        grandTotals?.prospect || 0,
        grandTotals?.talkTime || "",
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    if (reportType === "MASTER") {
      worksheet["!cols"] = [
        { wch: 8 }, // SR NO
        { wch: 25 }, // NAME
        { wch: 12 }, // ANS CALLS
        { wch: 14 }, // MISSED CALLS
        { wch: 12 }, // PROSPECT
        { wch: 12 }, // TALKTIME
        { wch: 12 }, // TOTAL CALLS
        { wch: 10 }, // CRM CALLS
        { wch: 12 }, // CRM PROSPECT
        { wch: 12 }, // GRAND PROSPECT
        { wch: 12 }, // GRAND CALLS
      ];
      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Title row
        { s: { r: 1, c: 2 }, e: { r: 1, c: 6 } }, // DIALER header
        { s: { r: 1, c: 7 }, e: { r: 1, c: 8 } }, // CRM header
        { s: { r: 1, c: 9 }, e: { r: 1, c: 10 } }, // GRAND TOTAL header
      ];
    } else if (reportType === "CRM") {
      worksheet["!cols"] = [
        { wch: 10 },
        { wch: 25 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
      ];
      worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
    } else {
      worksheet["!cols"] = [
        { wch: 10 },
        { wch: 25 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
      ];
      worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
    }

    // Title style
    worksheet["A1"].s = {
      font: { bold: true, sz: 20, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FFFF00" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "002060" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    const dialerHeaderStyle = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FFFF00" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    const crmHeaderStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "00B050" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    const grandTotalHeaderStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "0070C0" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    if (reportType === "MASTER") {
      const colCount = 11;
      const cols = "ABCDEFGHIJK".slice(0, colCount).split("");

      // Style category headers (row 2)
      ["C2", "D2", "E2", "F2", "G2"].forEach((cell) => {
        if (worksheet[cell]) worksheet[cell].s = dialerHeaderStyle;
      });
      ["H2", "I2"].forEach((cell) => {
        if (worksheet[cell]) worksheet[cell].s = crmHeaderStyle;
      });
      ["J2", "K2"].forEach((cell) => {
        if (worksheet[cell]) worksheet[cell].s = grandTotalHeaderStyle;
      });

      // Style sub-headers (row 3)
      cols.forEach((col) => {
        const cell = worksheet[col + "3"];
        if (cell) cell.s = headerStyle;
      });

      // Data rows start at row 4
      data.forEach((row, index) => {
        const excelRow = index + 4;
        const position = (index / data.length) * 100;
        const fillColor = position < 50 ? "CCFFCC" : "FFCCCC";

        const style = {
          fill: { fgColor: { rgb: fillColor } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };

        cols.forEach((col) => {
          const cell = worksheet[col + excelRow];
          if (cell) cell.s = style;
        });
      });

      // Grand total row
      const totalRow = worksheetData.length;
      const totalStyle = {
        font: { bold: true },
        fill: { fgColor: { rgb: "FFFF00" } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      cols.forEach((col) => {
        const cell = worksheet[col + totalRow];
        if (cell) cell.s = totalStyle;
      });

      // Merge grand total label
      worksheet["!merges"].push({
        s: { r: totalRow - 1, c: 0 },
        e: { r: totalRow - 1, c: 1 },
      });
    } else {
      const colCount = reportType === "CRM" ? 5 : 7;
      const cols = "ABCDEFGHIJK".slice(0, colCount).split("");

      cols.forEach((col) => {
        const cell = worksheet[col + "2"];
        if (cell) cell.s = headerStyle;
      });

      if (reportType === "DIALER" && talktimeThreshold) {
        const thresholdMinutes = convertTimeToMinutes(talktimeThreshold);

        data.forEach((row, index) => {
          const excelRow = index + 3;
          const agentTalktimeMinutes = convertTimeToMinutes(row.TALK_TIME);

          // Green if above threshold, Red if below threshold
          let fillColor;
          let fontColor = "000000"; // Black text by default

          if (agentTalktimeMinutes >= thresholdMinutes) {
            fillColor = "92D050"; // Green - Above threshold
          } else {
            fillColor = "FF0000"; // Red - Below threshold
            fontColor = "FFFFFF"; // White text for red background
          }

          const style = {
            font: { color: { rgb: fontColor } },
            fill: { fgColor: { rgb: fillColor } },
            alignment: { horizontal: "center" },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };

          cols.forEach((col) => {
            const cell = worksheet[col + excelRow];
            if (cell) cell.s = style;
          });
        });
      } else {
        // Original styling for CRM and non-threshold DIALER reports
        data.forEach((row, index) => {
          const excelRow = index + 3;
          const position = (index / data.length) * 100;
          const fillColor = position < 50 ? "CCFFCC" : "FFCCCC";

          const style = {
            fill: { fgColor: { rgb: fillColor } },
            alignment: { horizontal: "center" },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };

          cols.forEach((col) => {
            const cell = worksheet[col + excelRow];
            if (cell) cell.s = style;
          });
        });
      }

      const totalRow = worksheetData.length;
      const totalStyle = {
        font: { bold: true },
        fill: { fgColor: { rgb: "FFFF00" } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };

      cols.forEach((col) => {
        const cell = worksheet[col + totalRow];
        if (cell) cell.s = totalStyle;
      });

      const mergeCols = 1;
      worksheet["!merges"].push({
        s: { r: totalRow - 1, c: 0 },
        e: { r: totalRow - 1, c: mergeCols },
      });
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, `${branch} Report`);

    const buffer = XLSX.write(workbook, { type: "buffer" });

    await supabase.from("download_logs").insert([
      {
        user_id,
        branch,
        report_type: reportType.toLowerCase(),
        downloaded_at: new Date().toISOString(),
      },
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${branch}_${reportType}_Report.xlsx"`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error in talktime-excel:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/dispo-excel", async (req, res) => {
  try {
    const { data, branch, user_id, summary, date } = req.body;

    if (!data || !branch || !user_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Format date for title
    const reportDate = new Date(date);
    const day = reportDate.getDate();
    const suffix =
      day === 1 || day === 21 || day === 31
        ? "ST"
        : day === 2 || day === 22
        ? "ND"
        : day === 3 || day === 23
        ? "RD"
        : "TH";
    const month = reportDate
      .toLocaleString("en-US", { month: "short" })
      .toUpperCase();
    const year = reportDate.getFullYear();
    const dateTitle = `${day}${suffix} ${month} ${year}`;

    // Title row
    worksheetData.push([`DISPO REPORT OF ${dateTitle} TILL TIME`]);

    worksheetData.push([
      "SR NO",
      "DISPO",
      "DIALER CALLS",
      "CRM CALLS",
      "TOTAL CALLS",
    ]);

    // Data rows
    data.forEach((row, i) => {
      worksheetData.push([
        i + 1,
        row.DISPO,
        row.DIALER_CALLS || 0,
        row.CRM_CALLS || 0,
        row.TOTAL_CALLS || 0,
      ]);
    });

    // Summary rows
    worksheetData.push([
      "GRAND TOTAL",
      "",
      summary.grandTotal.dialer,
      summary.grandTotal.crm,
      summary.grandTotal.total,
    ]);
    worksheetData.push([
      "ANS CALLS",
      "",
      summary.ansCalls.dialer,
      summary.ansCalls.crm,
      summary.ansCalls.total,
    ]);
    worksheetData.push([
      "PROSPECT",
      "",
      summary.prospect.dialer,
      summary.prospect.crm,
      summary.prospect.total,
    ]);
    worksheetData.push([
      "RATIO",
      "",
      summary.ratio.dialer,
      summary.ratio.crm,
      summary.ratio.total,
    ]);
    worksheetData.push([
      "PICKUP RATIO",
      "",
      summary.pickupRatio.dialer,
      summary.pickupRatio.crm,
      summary.pickupRatio.total,
    ]);
    worksheetData.push([
      "UNIQUE AGENTS",
      "",
      "",
      "",
      summary.uniqueAgents || 0,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
    ];
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    // ... existing code for title and header styles ...

    // Title style - deep blue background, white text
    worksheet["A1"].s = {
      font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "002060" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    // Header style - deep blue background, white text
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "002060" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };
    ["A2", "B2", "C2", "D2", "E2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = headerStyle;
    });

    // Data rows styling
    data.forEach((row, index) => {
      const excelRow = index + 3;
      const fillColor = getDispoFillColor(row.DISPO);
      const fontColor = getDispoFontColor(row.DISPO);

      const style = {
        font: { color: { rgb: fontColor } },
        fill: { fgColor: { rgb: fillColor } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };
      ["A", "B", "C", "D", "E"].forEach((col) => {
        const cell = worksheet[col + excelRow];
        if (cell) cell.s = style;
      });
    });

    // Summary row styles
    const dataLength = data.length + 3;

    // Grand Total - deep blue
    const grandTotalRow = dataLength;
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + grandTotalRow];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "002060" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // ANS CALLS - orange
    const ansRow = dataLength + 1;
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + ansRow];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "C65911" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // PROSPECT - green
    const prospectRow = dataLength + 2;
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + prospectRow];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "92D050" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // RATIO and PICKUP RATIO - light blue
    [dataLength + 3, dataLength + 4].forEach((rowNum) => {
      ["A", "B", "C", "D", "E"].forEach((col) => {
        const cell = worksheet[col + rowNum];
        if (cell)
          cell.s = {
            font: { bold: true, color: { rgb: "000000" } },
            fill: { fgColor: { rgb: "FF0000" } }, // Original color was C65911, changed to FF0000 as per prompt for ratio/pickup
            alignment: { horizontal: "center" },
            border: {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            },
          };
      });
    });

    const uniqueAgentsRow = dataLength + 5;
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + uniqueAgentsRow];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "00B0F0" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // Merge cells for summary labels
    worksheet["!merges"].push(
      { s: { r: grandTotalRow - 1, c: 0 }, e: { r: grandTotalRow - 1, c: 1 } },
      { s: { r: ansRow - 1, c: 0 }, e: { r: ansRow - 1, c: 1 } },
      { s: { r: prospectRow - 1, c: 0 }, e: { r: prospectRow - 1, c: 1 } },
      { s: { r: dataLength + 2, c: 0 }, e: { r: dataLength + 2, c: 1 } },
      { s: { r: dataLength + 3, c: 0 }, e: { r: dataLength + 3, c: 1 } },
      {
        s: { r: uniqueAgentsRow - 1, c: 0 },
        e: { r: uniqueAgentsRow - 1, c: 1 },
      },
      {
        s: { r: uniqueAgentsRow - 1, c: 2 },
        e: { r: uniqueAgentsRow - 1, c: 4 },
      }
    );

    XLSX.utils.book_append_sheet(workbook, worksheet, "Dispo Report");

    const buffer = XLSX.write(workbook, { type: "buffer" });

    await supabase.from("download_logs").insert([
      {
        user_id,
        branch,
        report_type: "dispo",
        downloaded_at: new Date().toISOString(),
      },
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${branch}_Dispo_Report.xlsx"`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error in dispo-excel:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/agent-dispo-excel", async (req, res) => {
  try {
    const { data, agentName, user_id, summary, startDate, endDate } = req.body;

    if (!data || !agentName || !user_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Format dates for title
    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      const day = d.getDate();
      const suffix =
        day === 1 || day === 21 || day === 31
          ? "ST"
          : day === 2 || day === 22
          ? "ND"
          : day === 3 || day === 23
          ? "RD"
          : "TH";
      const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
      const year = d.getFullYear();
      return `${day}${suffix} ${month} ${year}`;
    };

    const dateRange =
      startDate === endDate
        ? formatDate(startDate)
        : `${formatDate(startDate)} - ${formatDate(endDate)}`;

    // Title row
    worksheetData.push([`DISPO REPORT OF ${dateRange} (${agentName})`]);

    // Header row
    worksheetData.push([
      "SR NO",
      "DISPO",
      "DIALER CALLS",
      "CRM CALLS",
      "TOTAL CALLS",
    ]);

    // Data rows
    data.forEach((row, i) => {
      worksheetData.push([
        i + 1,
        row.DISPO,
        row.DIALER_CALLS || 0,
        row.CRM_CALLS || 0,
        row.TOTAL_CALLS || 0,
      ]);
    });

    // Summary rows
    worksheetData.push([
      "GRAND TOTAL",
      "",
      summary.grandTotal.dialer,
      summary.grandTotal.crm,
      summary.grandTotal.total,
    ]);
    worksheetData.push([
      "ANS CALLS",
      "",
      summary.ansCalls.dialer,
      summary.ansCalls.crm,
      summary.ansCalls.total,
    ]);
    worksheetData.push([
      "PROSPECT",
      "",
      summary.prospect.dialer,
      summary.prospect.crm,
      summary.prospect.total,
    ]);
    worksheetData.push([
      "RATIO",
      "",
      summary.ratio.dialer,
      summary.ratio.crm,
      summary.ratio.total,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
    ];
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    // Title style
    worksheet["A1"].s = {
      font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "002060" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    // Header style
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "002060" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };
    ["A2", "B2", "C2", "D2", "E2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = headerStyle;
    });

    // Data rows styling
    data.forEach((row, index) => {
      const excelRow = index + 3;
      const fillColor = getDispoFillColor(row.DISPO);
      const fontColor = getDispoFontColor(row.DISPO);

      const style = {
        font: { color: { rgb: fontColor } },
        fill: { fgColor: { rgb: fillColor } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };
      ["A", "B", "C", "D", "E"].forEach((col) => {
        const cell = worksheet[col + excelRow];
        if (cell) cell.s = style;
      });
    });

    // Summary row styles
    const dataLength = data.length + 3;

    // Grand Total
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + dataLength];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "002060" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // ANS CALLS
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + (dataLength + 1)];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "C65911" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // PROSPECT
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + (dataLength + 2)];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "92D050" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // RATIO
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + (dataLength + 3)];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "FF0000" } }, // Original color was F79646, changed to FF0000 as per prompt for ratio/pickup
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // Merge cells for summary labels
    worksheet["!merges"].push(
      { s: { r: dataLength - 1, c: 0 }, e: { r: dataLength - 1, c: 1 } },
      { s: { r: dataLength, c: 0 }, e: { r: dataLength, c: 1 } },
      { s: { r: dataLength + 1, c: 0 }, e: { r: dataLength + 1, c: 1 } },
      { s: { r: dataLength + 2, c: 0 }, e: { r: dataLength + 2, c: 1 } }
    );

    XLSX.utils.book_append_sheet(workbook, worksheet, "Agent Dispo Report");

    const buffer = XLSX.write(workbook, { type: "buffer" });

    await supabase.from("download_logs").insert([
      {
        user_id,
        branch: "AGENT",
        report_type: "agent_dispo",
        downloaded_at: new Date().toISOString(),
      },
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${agentName}_Dispo_Report.xlsx"`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error in agent-dispo-excel:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/agent-excel", async (req, res) => {
  try {
    const {
      data,
      agentName,
      user_id,
      grandTotals,
      startDate,
      endDate,
      talktimeThreshold,
    } = req.body;

    if (!data || !agentName || !user_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Format dates for title
    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      const day = d.getDate();
      const suffix =
        day === 1 || day === 21 || day === 31
          ? "ST"
          : day === 2 || day === 22
          ? "ND"
          : day === 3 || day === 23
          ? "RD"
          : "TH";
      const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
      const year = d.getFullYear();
      return `${day}${suffix} ${month} ${year}`;
    };

    const dateRange =
      startDate === endDate
        ? formatDate(startDate)
        : `${formatDate(startDate)} - ${formatDate(endDate)}`;

    worksheetData.push([`${agentName} REPORT (${dateRange})`]);
    worksheetData.push([
      "DATE",
      "ANS CALLS",
      "MISSED CALLS",
      "TOTAL CALLS",
      "PROSPECT",
      "TALK TIME",
    ]);

    data.forEach((row) => {
      worksheetData.push([
        row.DATE || "",
        row.ANS_CALLS || 0,
        row.MISSED_CALLS || 0,
        row.TOTAL_CALLS || 0,
        row.PROSPECT || 0,
        row.TALK_TIME || "",
      ]);
    });

    worksheetData.push([
      "GRAND TOTAL",
      grandTotals?.ansCalls || 0,
      grandTotals?.missedCalls || 0,
      grandTotals?.totalCalls || 0,
      grandTotals?.prospect || 0,
      grandTotals?.talkTime || "",
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    worksheet["!cols"] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

    worksheet["A1"].s = {
      font: { bold: true, sz: 16, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FFFF00" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    const headerStyle = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FFFF00" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };
    ["A2", "B2", "C2", "D2", "E2", "F2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = headerStyle;
    });

    data.forEach((row, index) => {
      const excelRow = index + 3;
      const position = (index / data.length) * 100;
      const fillColor = position < 50 ? "CCFFCC" : "FFCCCC";

      const style = {
        fill: { fgColor: { rgb: fillColor } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };
      ["A", "B", "C", "D", "E", "F"].forEach((col) => {
        const cell = worksheet[col + excelRow];
        if (cell) cell.s = style;
      });
    });

    const totalRow = worksheetData.length;
    const totalStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: "FFFF00" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      const cell = worksheet[col + totalRow];
      if (cell) cell.s = totalStyle;
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "Agent Report");

    const buffer = XLSX.write(workbook, { type: "buffer" });

    await supabase.from("download_logs").insert([
      {
        user_id,
        branch: "AGENT",
        report_type: "agent",
        downloaded_at: new Date().toISOString(),
      },
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${agentName}_Report.xlsx"`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error in agent-excel:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/pipeline-excel", async (req, res) => {
  try {
    const { data, branch, user_id, summary, grandTotals, month, year } =
      req.body;

    if (!data || !branch || !user_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    const monthNames = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    const monthName = month
      ? monthNames[month - 1]
      : monthNames[new Date().getMonth()];
    const reportYear = year || new Date().getFullYear();

    worksheetData.push([
      `${branch.toUpperCase()} PIPELINE REPORT - ${monthName} ${reportYear}`,
    ]);
    worksheetData.push([
      "SR NO.",
      "NAME",
      "INTERESTED",
      "INTRODUCTION",
      "TOTAL PROSPECT",
    ]);

    data.forEach((row, i) => {
      worksheetData.push([
        i + 1,
        row.NAME || "",
        row.INTERESTED || 0,
        row.INTRODUCTION || 0,
        row.TOTAL_PROSPECT || 0,
      ]);
    });

    worksheetData.push([
      "GRAND TOTAL",
      "",
      grandTotals?.interested || 0,
      grandTotals?.introduction || 0,
      grandTotals?.totalProspect || 0,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 25 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
    ];
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    worksheet["A1"].s = {
      font: { bold: true, sz: 16, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FFFF00" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    const headerStyle = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FFFF00" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };
    ["A2", "B2", "C2", "D2", "E2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = headerStyle;
    });

    data.forEach((row, index) => {
      const excelRow = index + 3;
      const position = (index / data.length) * 100;
      const fillColor = position < 50 ? "CCFFCC" : "FFCCCC";

      const style = {
        fill: { fgColor: { rgb: fillColor } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };
      ["A", "B", "C", "D", "E"].forEach((col) => {
        const cell = worksheet[col + excelRow];
        if (cell) cell.s = style;
      });
    });

    const totalRow = worksheetData.length;
    const totalStyle = {
      font: { bold: true },
      fill: { fgColor: { rgb: "FFFF00" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + totalRow];
      if (cell) cell.s = totalStyle;
    });

    worksheet["!merges"].push({
      s: { r: totalRow - 1, c: 0 },
      e: { r: totalRow - 1, c: 1 },
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, `${branch} Pipeline`);

    const buffer = XLSX.write(workbook, { type: "buffer" });

    await supabase.from("download_logs").insert([
      {
        user_id,
        branch,
        report_type: "pipeline",
        downloaded_at: new Date().toISOString(),
      },
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${branch}_Pipeline_Report.xlsx"`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error in pipeline-excel:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/merged-dispo-excel", async (req, res) => {
  try {
    const { data, user_id, summary, date } = req.body;

    if (!data || !user_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Format date for title
    const reportDate = new Date(date);
    const day = reportDate.getDate();
    const suffix =
      day === 1 || day === 21 || day === 31
        ? "ST"
        : day === 2 || day === 22
        ? "ND"
        : day === 3 || day === 23
        ? "RD"
        : "TH";
    const month = reportDate
      .toLocaleString("en-US", { month: "short" })
      .toUpperCase();
    const year = reportDate.getFullYear();
    const dateTitle = `${day}${suffix} ${month} ${year}`;

    // Title row
    worksheetData.push([`BRANCH WISE DISPO REPORT OF ${dateTitle} (TODAY)`]);

    worksheetData.push([
      "SR NO",
      "DISPO",
      "AHMEDABAD",
      "CHENNAI",
      "NOIDA",
      "GRAND TOTAL",
    ]);

    // Data rows - using simpler format matching the UI
    data.forEach((row, i) => {
      worksheetData.push([
        i + 1,
        row.DISPO,
        row.AHMEDABAD || 0,
        row.CHENNAI || 0,
        row.NOIDA || 0,
        row.TOTAL_CALLS || 0,
      ]);
    });

    // Summary rows matching UI
    worksheetData.push([
      "GRAND TOTAL",
      "",
      summary.grandTotal.ahmedabad,
      summary.grandTotal.chennai,
      summary.grandTotal.noida,
      summary.grandTotal.total,
    ]);
    worksheetData.push([
      "ANS CALLS",
      "",
      summary.ansCalls.ahmedabad,
      summary.ansCalls.chennai,
      summary.ansCalls.noida,
      summary.ansCalls.total,
    ]);
    worksheetData.push([
      "PROSPECT",
      "",
      summary.prospect.ahmedabad,
      summary.prospect.chennai,
      summary.prospect.noida,
      summary.prospect.total,
    ]);
    worksheetData.push([
      "RATIO",
      "",
      summary.ratio.ahmedabad,
      summary.ratio.chennai,
      summary.ratio.noida,
      summary.ratio.total,
    ]);
    worksheetData.push([
      "PICKUP RATIO",
      "",
      summary.pickupRatio.ahmedabad,
      summary.pickupRatio.chennai,
      summary.pickupRatio.noida,
      summary.pickupRatio.total,
    ]);
    worksheetData.push([
      "UNIQUE AGENTS",
      "",
      summary.uniqueAgents?.ahmedabad || 0,
      summary.uniqueAgents?.chennai || 0,
      summary.uniqueAgents?.noida || 0,
      summary.uniqueAgents?.total || 0,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    worksheet["!cols"] = [
      { wch: 6 }, // SR NO
      { wch: 16 }, // DISPO
      { wch: 12 }, // AHMEDABAD
      { wch: 10 }, // CHENNAI
      { wch: 10 }, // NOIDA
      { wch: 12 }, // GRAND TOTAL
    ];

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Title
    ];

    // Title style - deep blue
    worksheet["A1"].s = {
      font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "002060" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    // Header style - deep blue
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "002060" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    };

    // Apply header styles (row 2)
    ["A2", "B2", "C2", "D2", "E2", "F2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = headerStyle;
    });

    // Data rows styling
    data.forEach((row, index) => {
      const excelRow = index + 3;
      const fillColor = getDispoFillColor(row.DISPO);
      const fontColor = getDispoFontColor(row.DISPO);

      const style = {
        font: { color: { rgb: fontColor } },
        fill: { fgColor: { rgb: fillColor } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        },
      };
      ["A", "B", "C", "D", "E", "F"].forEach((col) => {
        const cell = worksheet[col + excelRow];
        if (cell) cell.s = style;
      });
    });

    // Summary row styles
    const dataLength = data.length + 3;

    // Grand Total - orange
    const grandTotalRow = dataLength;
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      const cell = worksheet[col + grandTotalRow];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "F79646" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // ANS CALLS - yellow
    const ansRow = dataLength + 1;
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      const cell = worksheet[col + ansRow];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "FFFF00" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // PROSPECT - light blue
    const prospectRow = dataLength + 2;
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      const cell = worksheet[col + prospectRow];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "00B0F0" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // RATIO - orange (matching the image yellow background)
    const ratioRow = dataLength + 3;
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      const cell = worksheet[col + ratioRow];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "FFFF00" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // PICKUP RATIO - red (matching the image)
    const pickupRow = dataLength + 4;
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      const cell = worksheet[col + pickupRow];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "FF0000" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    const uniqueAgentsRow = dataLength + 5;
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      const cell = worksheet[col + uniqueAgentsRow];
      if (cell)
        cell.s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: { fgColor: { rgb: "00B0F0" } },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          },
        };
    });

    // Merge cells for summary labels
    worksheet["!merges"].push(
      { s: { r: grandTotalRow - 1, c: 0 }, e: { r: grandTotalRow - 1, c: 1 } },
      { s: { r: ansRow - 1, c: 0 }, e: { r: ansRow - 1, c: 1 } },
      { s: { r: prospectRow - 1, c: 0 }, e: { r: prospectRow - 1, c: 1 } },
      { s: { r: ratioRow - 1, c: 0 }, e: { r: ratioRow - 1, c: 1 } },
      { s: { r: pickupRow - 1, c: 0 }, e: { r: pickupRow - 1, c: 1 } },
      {
        s: { r: uniqueAgentsRow - 1, c: 0 },
        e: { r: uniqueAgentsRow - 1, c: 1 },
      }
    );

    XLSX.utils.book_append_sheet(workbook, worksheet, "Merged Dispo Report");

    const buffer = XLSX.write(workbook, { type: "buffer" });

    await supabase.from("download_logs").insert([
      {
        user_id,
        branch: "MERGED",
        report_type: "dispo",
        downloaded_at: new Date().toISOString(),
      },
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Merged_Dispo_Report_${date}.xlsx"`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error in merged-dispo-excel:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/logs", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("download_logs")
      .select(
        `
        *,
        users:user_id (
          username
        )
      `
      )
      .order("downloaded_at", { ascending: false })
      .limit(100);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
