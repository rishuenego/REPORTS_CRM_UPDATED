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

router.post("/talktime-excel", async (req, res) => {
  try {
    const { data, branch, user_id, grandTotals, talktimeThreshold } = req.body;

    if (!data || !branch || !user_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    const branchHeader = `${branch.toUpperCase()} TALK TIME REPORT`;
    worksheetData.push([branchHeader]);

    worksheetData.push([
      "SR NO.",
      "NAME",
      "ANS CALLS",
      "MISSED CALLS",
      "TOTAL CALLS",
      "TALK TIME",
      "PROSPECT",
    ]);

    data.forEach((row, i) => {
      worksheetData.push([
        i + 1,
        row.NAME || "",
        row.ANS_CALLS || 0,
        row.MISSED_CALLS || 0,
        row.TOTAL_CALLS || 0,
        row.TALK_TIME || "",
        row.PROSPECT || 0,
      ]);
    });

    worksheetData.push([
      "GRAND TOTAL",
      "",
      grandTotals?.ansCalls || 0,
      grandTotals?.missedCalls || 0,
      grandTotals?.totalCalls || 0,
      grandTotals?.talkTime || "",
      grandTotals?.prospect || 0,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

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
    ["A2", "B2", "C2", "D2", "E2", "F2", "G2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = headerStyle;
    });

    data.forEach((row, index) => {
      const excelRow = index + 3;

      let fillColor;
      if (talktimeThreshold !== undefined && talktimeThreshold !== null) {
        const agentMinutes = convertTimeToMinutes(row.TALK_TIME || "0:0:0");
        fillColor = agentMinutes >= talktimeThreshold ? "CCFFCC" : "FFCCCC";
      } else {
        const position = (index / data.length) * 100;
        fillColor = position < 50 ? "CCFFCC" : "FFCCCC";
      }

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
      ["A", "B", "C", "D", "E", "F", "G"].forEach((col) => {
        const cell = worksheet[col + excelRow];
        if (cell) cell.s = style;
      });
    });

    const totalRow = worksheetData.length;
    const totalCells = ["A", "B", "C", "D", "E", "F", "G"];

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

    totalCells.forEach((col) => {
      const cell = worksheet[col + totalRow];
      if (cell) cell.s = totalStyle;
    });

    worksheet["!merges"].push({
      s: { r: totalRow - 1, c: 0 },
      e: { r: totalRow - 1, c: 1 },
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, `${branch} Report`);

    const buffer = XLSX.write(workbook, { type: "buffer" });

    await supabase.from("download_logs").insert([
      {
        user_id,
        branch,
        report_type: "talktime",
        downloaded_at: new Date().toISOString(),
      },
    ]);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${branch}_TalkTime_Report.xlsx"`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error in talktime-excel:", error);
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

    const header = `${agentName} - AGENT REPORT (${startDate} to ${endDate})`;
    worksheetData.push([header]);

    worksheetData.push([
      "SR NO.",
      "DATE",
      "ANS CALLS",
      "MISSED CALLS",
      "TOTAL CALLS",
      "TALK TIME",
      "PROSPECT",
    ]);

    data.forEach((row, i) => {
      worksheetData.push([
        i + 1,
        row.DATE ? new Date(row.DATE).toLocaleDateString("en-IN") : "",
        row.ANS_CALLS || 0,
        row.MISSED_CALLS || 0,
        row.TOTAL_CALLS || 0,
        row.TALK_TIME || "",
        row.PROSPECT || 0,
      ]);
    });

    worksheetData.push([
      "GRAND TOTAL",
      "",
      grandTotals?.ansCalls || 0,
      grandTotals?.missedCalls || 0,
      grandTotals?.totalCalls || 0,
      grandTotals?.talkTime || "",
      grandTotals?.prospect || 0,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 15 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

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
    ["A2", "B2", "C2", "D2", "E2", "F2", "G2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = headerStyle;
    });

    data.forEach((row, index) => {
      const excelRow = index + 3;

      let fillColor;
      if (talktimeThreshold !== undefined && talktimeThreshold !== null) {
        const agentMinutes = convertTimeToMinutes(row.TALK_TIME || "0:0:0");
        fillColor = agentMinutes >= talktimeThreshold ? "CCFFCC" : "FFCCCC";
      } else {
        fillColor = index % 2 === 0 ? "FFFFFF" : "F0F0F0";
      }

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
      ["A", "B", "C", "D", "E", "F", "G"].forEach((col) => {
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
    ["A", "B", "C", "D", "E", "F", "G"].forEach((col) => {
      const cell = worksheet[col + totalRow];
      if (cell) cell.s = totalStyle;
    });

    worksheet["!merges"].push({
      s: { r: totalRow - 1, c: 0 },
      e: { r: totalRow - 1, c: 1 },
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
      `attachment; filename="${agentName}_Agent_Report.xlsx"`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error in agent-excel:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/pipeline-excel", async (req, res) => {
  try {
    const { data, branch, user_id, summary, grandTotals } = req.body;

    if (!branch || !user_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const workbook = XLSX.utils.book_new();

    const summaryData = [];
    const branchHeader = `${branch.toUpperCase()} PIPELINE REPORT - SUMMARY`;
    summaryData.push([branchHeader]);
    summaryData.push([
      "SR NO.",
      "EMPLOYEE NAME",
      "NO. OF CLIENTS",
      "EXPECTED REVENUE",
    ]);

    summary.forEach((row, i) => {
      summaryData.push([
        i + 1,
        row.name || "Unassigned",
        row.clientCount || 0,
        row.totalRevenue || 0,
      ]);
    });

    summaryData.push([
      "GRAND TOTAL",
      "",
      grandTotals?.totalClients || 0,
      grandTotals?.totalRevenue || 0,
    ]);

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    summarySheet["!cols"] = [
      { wch: 10 },
      { wch: 30 },
      { wch: 15 },
      { wch: 20 },
    ];

    summarySheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

    summarySheet["A1"].s = {
      font: { bold: true, sz: 18, color: { rgb: "000000" } },
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
    ["A2", "B2", "C2", "D2"].forEach((cell) => {
      if (summarySheet[cell]) summarySheet[cell].s = headerStyle;
    });

    summary.forEach((row, index) => {
      const excelRow = index + 3;
      const position = (index / summary.length) * 100;
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
      ["A", "B", "C", "D"].forEach((col) => {
        const cell = summarySheet[col + excelRow];
        if (cell) cell.s = style;
      });
    });

    const totalRow = summaryData.length;
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
    ["A", "B", "C", "D"].forEach((col) => {
      const cell = summarySheet[col + totalRow];
      if (cell) cell.s = totalStyle;
    });

    summarySheet["!merges"].push({
      s: { r: totalRow - 1, c: 0 },
      e: { r: totalRow - 1, c: 1 },
    });

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    if (data && data.length > 0) {
      const detailData = [];
      detailData.push([`${branch.toUpperCase()} PIPELINE REPORT - DETAILED`]);
      detailData.push([
        "SR NO.",
        "EMPLOYEE",
        "COMPANY",
        "EMAIL",
        "CONTACT",
        "CREATED",
        "EXPECTED REVENUE",
      ]);

      data.forEach((row, i) => {
        detailData.push([
          i + 1,
          row.employee_name || "Unassigned",
          row.company_name || "-",
          row.email || "-",
          row.contact || "-",
          row.create_date
            ? new Date(row.create_date).toLocaleDateString()
            : "-",
          row.expected_revenue || 0,
        ]);
      });

      const detailSheet = XLSX.utils.aoa_to_sheet(detailData);

      detailSheet["!cols"] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 30 },
        { wch: 30 },
        { wch: 15 },
        { wch: 12 },
        { wch: 18 },
      ];

      detailSheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

      detailSheet["A1"].s = {
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
      ["A2", "B2", "C2", "D2", "E2", "F2", "G2"].forEach((cell) => {
        if (detailSheet[cell]) detailSheet[cell].s = headerStyle;
      });

      data.forEach((row, index) => {
        const excelRow = index + 3;
        const fillColor = index % 2 === 0 ? "CCFFCC" : "FFFFFF";

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
        ["A", "B", "C", "D", "E", "F", "G"].forEach((col) => {
          const cell = detailSheet[col + excelRow];
          if (cell) cell.s = style;
        });
      });

      XLSX.utils.book_append_sheet(workbook, detailSheet, "Detailed");
    }

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

export default router;
