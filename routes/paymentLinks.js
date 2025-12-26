import express from "express";
import { mysqlPool, pgPool } from "../index.js";

const router = express.Router();

const getBranchId = (branch) => {
  const branchMap = { AHM: 1, NOIDA: 2, CHENNAI: 3 };
  return branchMap[branch.toUpperCase()];
};

// Get payment links report
router.get("/report", async (req, res) => {
  let mysqlConnection = null;
  let pgConnection = null;

  try {
    const { branches, startDate, endDate, showPaid, showPending } = req.query;

    if (!branches) {
      return res.status(400).json({ error: "Branches parameter is required" });
    }

    const branchList = branches.split(",");
    const branchIds = branchList.map((b) => getBranchId(b)).filter(Boolean);

    if (branchIds.length === 0) {
      return res.status(400).json({ error: "Invalid branch names" });
    }

    // Fetch payment data from MySQL (razorpay database)
    mysqlConnection = await mysqlPool.getConnection();

    const [paymentRows] = await mysqlConnection.execute(
      `SELECT 
        e.name AS employee_name,
        r.amount,
        DATE(r.created_at) AS date,
        CASE 
          WHEN r.status IS NULL OR r.status = '' THEN 'received'
          ELSE 'pending'
        END AS status
      FROM razorpay.payment_requests AS r
      LEFT JOIN razorpay.employees AS e ON e.id = r.employee_id
      WHERE DATE(r.created_at) BETWEEN ? AND ?
      ORDER BY r.created_at DESC`,
      [
        startDate || "2024-01-01",
        endDate || new Date().toISOString().split("T")[0],
      ]
    );

    mysqlConnection.release();
    mysqlConnection = null;

    // Get employee names from PostgreSQL for the selected branches
    pgConnection = await pgPool.connect();

    const branchPlaceholders = branchIds.map((_, i) => `$${i + 1}`).join(",");
    const { rows: employees } = await pgConnection.query(
      `SELECT id, name, user_id FROM public.hr_employee WHERE branch_id IN (${branchPlaceholders}) ORDER BY id ASC`,
      branchIds
    );

    pgConnection.release();
    pgConnection = null;

    const employeeNames = employees
      .map((e) => e.name?.toLowerCase())
      .filter(Boolean);

    // Filter payment data by employee names from selected branches
    let filteredData = paymentRows.filter((row) => {
      if (!row.employee_name) return false;
      const empNameLower = row.employee_name.toLowerCase();
      return employeeNames.some(
        (name) => empNameLower.includes(name) || name.includes(empNameLower)
      );
    });

    // Apply status filters
    const showPaidBool = showPaid === "true" || showPaid === true;
    const showPendingBool = showPending === "true" || showPending === true;

    if (!showPaidBool && !showPendingBool) {
      // If both are false, show nothing (or you could show all)
      filteredData = [];
    } else if (!showPaidBool) {
      filteredData = filteredData.filter((row) => row.status === "pending");
    } else if (!showPendingBool) {
      filteredData = filteredData.filter((row) => row.status === "received");
    }

    // Calculate summary
    let totalReceived = 0;
    let totalPending = 0;

    filteredData.forEach((row) => {
      const amount = Number(row.amount) || 0;
      if (row.status === "received") {
        totalReceived += amount;
      } else {
        totalPending += amount;
      }
    });

    res.json({
      data: filteredData.map((row) => ({
        employee_name: row.employee_name,
        amount: Number(row.amount) || 0,
        date: row.date,
        status: row.status,
      })),
      summary: {
        totalReceived,
        totalPending,
        totalAmount: totalReceived + totalPending,
        count: filteredData.length,
      },
    });
  } catch (error) {
    console.error("Payment Links Report Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
    if (pgConnection) {
      try {
        pgConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

// Download payment links report as Excel
router.post("/download", async (req, res) => {
  try {
    const { data, summary, branches, startDate, endDate } = req.body;

    // Using ExcelJS for Excel generation
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.default.Workbook();
    const worksheet = workbook.addWorksheet("Payment Links Report");

    // Title
    worksheet.mergeCells("A1:E1");
    worksheet.getCell("A1").value = `Payment Links Report - ${branches}`;
    worksheet.getCell("A1").font = { size: 16, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    // Date range
    worksheet.mergeCells("A2:E2");
    worksheet.getCell("A2").value = `Period: ${startDate} to ${endDate}`;
    worksheet.getCell("A2").alignment = { horizontal: "center" };

    // Headers
    const headerRow = worksheet.addRow([
      "SR NO.",
      "EMPLOYEE NAME",
      "AMOUNT",
      "DATE",
      "STATUS",
    ]);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFACC15" },
      };
      cell.font = { bold: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Data rows
    data.forEach((row, index) => {
      const dataRow = worksheet.addRow([
        index + 1,
        row.employee_name || "Unknown",
        row.amount,
        row.date,
        row.status === "received" ? "Received" : "Pending",
      ]);

      dataRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        // Color code status
        if (colNumber === 5) {
          if (row.status === "received") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF22C55E" },
            };
            cell.font = { color: { argb: "FFFFFFFF" } };
          } else {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFEAB308" },
            };
          }
        }
      });
    });

    // Summary row
    const summaryRow = worksheet.addRow([
      "",
      "GRAND TOTAL",
      summary.totalAmount,
      "",
      `${data.length} Records`,
    ]);
    summaryRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFACC15" },
      };
      cell.font = { bold: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Column widths
    worksheet.columns = [
      { width: 10 },
      { width: 30 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
    ];

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Payment_Links_Report.xlsx`
    );
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Download Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
