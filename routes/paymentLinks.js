import express from "express";
import { mysqlPool, pgPool, supabase } from "../index.js";
import XLSX from "xlsx-js-style";

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

router.get("/status-report", async (req, res) => {
  let mysqlConnection = null;
  let pgConnection = null;

  try {
    const { startDate, endDate } = req.query;

    const start =
      startDate ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split("T")[0];
    const end = endDate || new Date().toISOString().split("T")[0];

    // Get employee branch mapping from PostgreSQL
    pgConnection = await pgPool.connect();

    const { rows: employees } = await pgConnection.query(
      `SELECT id, name, branch_id FROM public.hr_employee ORDER BY id ASC`
    );

    pgConnection.release();
    pgConnection = null;

    // Create employee name to branch mapping (more flexible matching)
    const employeeBranchMap = new Map();
    employees.forEach((emp) => {
      if (emp.name) {
        // Store both full name and trimmed version
        employeeBranchMap.set(emp.name.toLowerCase().trim(), emp.branch_id);
      }
    });

    // Fetch ALL payment data from MySQL (both link generated and received)
    mysqlConnection = await mysqlPool.getConnection();

    // Query for payment links - link generated is total amount, received is when status is null/empty
    const [paymentRows] = await mysqlConnection.execute(
      `SELECT 
        e.name AS employee_name,
        r.amount,
        DATE(r.created_at) AS date,
        r.status
      FROM razorpay.payment_requests AS r
      LEFT JOIN razorpay.employees AS e ON e.id = r.employee_id
      WHERE DATE(r.created_at) BETWEEN ? AND ?
      ORDER BY DATE(r.created_at) ASC`,
      [start, end]
    );

    mysqlConnection.release();
    mysqlConnection = null;

    // Group data by date and branch
    const dateMap = new Map();

    paymentRows.forEach((row) => {
      if (!row.date) return;

      const dateKey = new Date(row.date).toISOString().split("T")[0];

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          date: dateKey,
          ahm_link_generated: 0,
          ahm_rec_amount: 0,
          chennai_link_generated: 0,
          chennai_rec_amount: 0,
          noida_link_generated: 0,
          noida_rec_amount: 0,
          total_link_generated: 0,
          total_rec_amount: 0,
          pending: 0,
        });
      }

      const dayData = dateMap.get(dateKey);
      const amount = Number(row.amount) || 0;
      const empName = row.employee_name?.toLowerCase().trim() || "";

      // Check if payment was received (status is null or empty means received)
      const isReceived =
        row.status === null || row.status === "" || row.status === "received";

      // Find which branch this employee belongs to
      let branchId = null;

      // Try exact match first
      if (employeeBranchMap.has(empName)) {
        branchId = employeeBranchMap.get(empName);
      } else {
        // Try partial match
        for (const [name, bId] of employeeBranchMap.entries()) {
          if (empName.includes(name) || name.includes(empName)) {
            branchId = bId;
            break;
          }
        }
      }

      // Branch IDs: 1 = AHM, 2 = NOIDA, 3 = CHENNAI
      // LINK GENERATED = Sum of ALL amounts for that date (total links created)
      // REC AMOUNT = Sum of amounts where status is received

      if (branchId === 1) {
        // AHMEDABAD
        dayData.ahm_link_generated += amount;
        if (isReceived) {
          dayData.ahm_rec_amount += amount;
        }
      } else if (branchId === 3) {
        // CHENNAI
        dayData.chennai_link_generated += amount;
        if (isReceived) {
          dayData.chennai_rec_amount += amount;
        }
      } else if (branchId === 2) {
        // NOIDA
        dayData.noida_link_generated += amount;
        if (isReceived) {
          dayData.noida_rec_amount += amount;
        }
      }

      // Add to totals
      dayData.total_link_generated += amount;
      if (isReceived) {
        dayData.total_rec_amount += amount;
      }
    });

    // Calculate pending for each date (LINK GENERATED - REC AMOUNT)
    dateMap.forEach((day) => {
      day.pending = day.total_link_generated - day.total_rec_amount;
    });

    // Sort by date and convert to array
    const data = Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate grand totals
    const grandTotals = {
      ahm_link_generated: 0,
      ahm_rec_amount: 0,
      chennai_link_generated: 0,
      chennai_rec_amount: 0,
      noida_link_generated: 0,
      noida_rec_amount: 0,
      total_link_generated: 0,
      total_rec_amount: 0,
      pending: 0,
    };

    data.forEach((day) => {
      grandTotals.ahm_link_generated += day.ahm_link_generated;
      grandTotals.ahm_rec_amount += day.ahm_rec_amount;
      grandTotals.chennai_link_generated += day.chennai_link_generated;
      grandTotals.chennai_rec_amount += day.chennai_rec_amount;
      grandTotals.noida_link_generated += day.noida_link_generated;
      grandTotals.noida_rec_amount += day.noida_rec_amount;
      grandTotals.total_link_generated += day.total_link_generated;
      grandTotals.total_rec_amount += day.total_rec_amount;
    });

    // Calculate grand total pending
    grandTotals.pending =
      grandTotals.total_link_generated - grandTotals.total_rec_amount;

    console.log(
      `[PaymentStatus] Found ${data.length} days of data from ${start} to ${end}`
    );

    res.json({ data, grandTotals });
  } catch (error) {
    console.error("Payment Status Report Error:", error);
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

router.get("/monthly-status", async (req, res) => {
  let mysqlConnection = null;
  let pgConnection = null;

  try {
    const { month, year } = req.query;
    const monthNum = Number.parseInt(month) || new Date().getMonth() + 1;
    const yearNum = Number.parseInt(year) || new Date().getFullYear();

    // Calculate start and end dates for the month
    const startDate = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${yearNum}-${String(monthNum).padStart(
      2,
      "0"
    )}-${lastDay}`;

    // Get employee branch mapping from PostgreSQL
    pgConnection = await pgPool.connect();
    const { rows: employees } = await pgConnection.query(
      `SELECT id, name, branch_id FROM public.hr_employee ORDER BY id ASC`
    );
    pgConnection.release();
    pgConnection = null;

    // Create employee name to branch mapping
    const employeeBranchMap = new Map();
    employees.forEach((emp) => {
      if (emp.name) {
        employeeBranchMap.set(emp.name.toLowerCase().trim(), emp.branch_id);
      }
    });

    // Fetch payment data from MySQL
    mysqlConnection = await mysqlPool.getConnection();
    const [paymentRows] = await mysqlConnection.execute(
      `SELECT 
        e.name AS employee_name,
        r.amount,
        r.status
      FROM razorpay.payment_requests AS r
      LEFT JOIN razorpay.employees AS e ON e.id = r.employee_id
      WHERE DATE(r.created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );
    mysqlConnection.release();
    mysqlConnection = null;

    // Initialize branch totals
    const branchData = {
      NOIDA: { total_link_generated: 0, rec_amount: 0, pending: 0 },
      AHMEDABAD: { total_link_generated: 0, rec_amount: 0, pending: 0 },
      CHENNAI: { total_link_generated: 0, rec_amount: 0, pending: 0 },
    };

    // Process payments
    paymentRows.forEach((row) => {
      const amount = Number(row.amount) || 0;
      const empName = row.employee_name?.toLowerCase().trim() || "";
      const isReceived =
        row.status === null || row.status === "" || row.status === "received";

      // Find branch
      let branchId = null;
      if (employeeBranchMap.has(empName)) {
        branchId = employeeBranchMap.get(empName);
      } else {
        for (const [name, bId] of employeeBranchMap.entries()) {
          if (empName.includes(name) || name.includes(empName)) {
            branchId = bId;
            break;
          }
        }
      }

      let branchName = null;
      if (branchId === 1) branchName = "AHMEDABAD";
      else if (branchId === 2) branchName = "NOIDA";
      else if (branchId === 3) branchName = "CHENNAI";

      if (branchName) {
        branchData[branchName].total_link_generated += amount;
        if (isReceived) {
          branchData[branchName].rec_amount += amount;
        }
      }
    });

    // Calculate pending for each branch
    Object.keys(branchData).forEach((branch) => {
      branchData[branch].pending =
        branchData[branch].total_link_generated - branchData[branch].rec_amount;
    });

    // Format response data (NOIDA first, then AHMEDABAD, then CHENNAI)
    const data = [
      { branch: "NOIDA", ...branchData.NOIDA },
      { branch: "AHMEDABAD", ...branchData.AHMEDABAD },
      { branch: "CHENNAI", ...branchData.CHENNAI },
    ];

    const totals = {
      total_link_generated: data.reduce(
        (sum, d) => sum + d.total_link_generated,
        0
      ),
      rec_amount: data.reduce((sum, d) => sum + d.rec_amount, 0),
      pending: data.reduce((sum, d) => sum + d.pending, 0),
    };

    res.json({ data, totals, month: monthNum, year: yearNum });
  } catch (error) {
    console.error("Monthly Payment Status Error:", error);
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

router.get("/daily-status", async (req, res) => {
  let mysqlConnection = null;
  let pgConnection = null;

  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split("T")[0];

    // Get employee branch mapping from PostgreSQL
    pgConnection = await pgPool.connect();
    const { rows: employees } = await pgConnection.query(
      `SELECT id, name, branch_id FROM public.hr_employee ORDER BY id ASC`
    );
    pgConnection.release();
    pgConnection = null;

    // Create employee name to branch mapping
    const employeeBranchMap = new Map();
    employees.forEach((emp) => {
      if (emp.name) {
        employeeBranchMap.set(emp.name.toLowerCase().trim(), emp.branch_id);
      }
    });

    // Fetch payment data from MySQL for the specific date
    mysqlConnection = await mysqlPool.getConnection();
    const [paymentRows] = await mysqlConnection.execute(
      `SELECT 
        e.name AS employee_name,
        r.amount,
        r.status
      FROM razorpay.payment_requests AS r
      LEFT JOIN razorpay.employees AS e ON e.id = r.employee_id
      WHERE DATE(r.created_at) = ?`,
      [reportDate]
    );
    mysqlConnection.release();
    mysqlConnection = null;

    // Initialize branch totals
    const branchData = {
      NOIDA: { total_link_generated: 0, rec_amount: 0, pending: 0 },
      AHMEDABAD: { total_link_generated: 0, rec_amount: 0, pending: 0 },
      CHENNAI: { total_link_generated: 0, rec_amount: 0, pending: 0 },
    };

    // Process payments
    paymentRows.forEach((row) => {
      const amount = Number(row.amount) || 0;
      const empName = row.employee_name?.toLowerCase().trim() || "";
      const isReceived =
        row.status === null || row.status === "" || row.status === "received";

      // Find branch
      let branchId = null;
      if (employeeBranchMap.has(empName)) {
        branchId = employeeBranchMap.get(empName);
      } else {
        for (const [name, bId] of employeeBranchMap.entries()) {
          if (empName.includes(name) || name.includes(empName)) {
            branchId = bId;
            break;
          }
        }
      }

      let branchName = null;
      if (branchId === 1) branchName = "AHMEDABAD";
      else if (branchId === 2) branchName = "NOIDA";
      else if (branchId === 3) branchName = "CHENNAI";

      if (branchName) {
        branchData[branchName].total_link_generated += amount;
        if (isReceived) {
          branchData[branchName].rec_amount += amount;
        }
      }
    });

    // Calculate pending for each branch
    Object.keys(branchData).forEach((branch) => {
      branchData[branch].pending =
        branchData[branch].total_link_generated - branchData[branch].rec_amount;
    });

    // Format response data
    const data = [
      { branch: "NOIDA", ...branchData.NOIDA },
      { branch: "AHMEDABAD", ...branchData.AHMEDABAD },
      { branch: "CHENNAI", ...branchData.CHENNAI },
    ];

    const totals = {
      total_link_generated: data.reduce(
        (sum, d) => sum + d.total_link_generated,
        0
      ),
      rec_amount: data.reduce((sum, d) => sum + d.rec_amount, 0),
      pending: data.reduce((sum, d) => sum + d.pending, 0),
    };

    res.json({ data, totals, date: reportDate });
  } catch (error) {
    console.error("Daily Payment Status Error:", error);
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

router.post("/download", async (req, res) => {
  try {
    const { data, summary, branches, startDate, endDate, user_id } = req.body;

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "No data to download" });
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Title row
    worksheetData.push([`Payment Links Report - ${branches}`]);

    // Date range row
    worksheetData.push([`Period: ${startDate} to ${endDate}`]);

    // Empty row
    worksheetData.push([]);

    // Header row
    worksheetData.push(["SR NO.", "EMPLOYEE NAME", "AMOUNT", "DATE", "STATUS"]);

    // Data rows
    data.forEach((row, index) => {
      worksheetData.push([
        index + 1,
        row.employee_name || "Unknown",
        row.amount,
        row.date,
        row.status === "received" ? "Received" : "Pending",
      ]);
    });

    // Summary row
    worksheetData.push([
      "GRAND TOTAL",
      "",
      summary.totalAmount,
      "",
      `${data.length} Records`,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Column widths
    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
    ];

    // Merge title cells
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];

    // Style definitions
    const titleStyle = {
      font: { bold: true, sz: 16, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FACC15" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    const dateRangeStyle = {
      font: { sz: 12 },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    const headerStyle = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FACC15" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    // Apply title style
    if (worksheet["A1"]) worksheet["A1"].s = titleStyle;
    if (worksheet["A2"]) worksheet["A2"].s = dateRangeStyle;

    // Apply header styles
    ["A4", "B4", "C4", "D4", "E4"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = headerStyle;
    });

    // Data row styles
    data.forEach((row, index) => {
      const excelRow = index + 5;
      const fillColor = index % 2 === 0 ? "FFFFFF" : "F8FAFC";

      const style = {
        fill: { fgColor: { rgb: fillColor } },
        alignment: { horizontal: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
      ["A", "B", "C", "D"].forEach((col) => {
        const cell = worksheet[col + excelRow];
        if (cell) cell.s = style;
      });

      // Status cell with color
      const statusCell = worksheet["E" + excelRow];
      if (statusCell) {
        statusCell.s = {
          font: {
            color: { rgb: row.status === "received" ? "FFFFFF" : "000000" },
          },
          fill: {
            fgColor: { rgb: row.status === "received" ? "22C55E" : "EAB308" },
          },
          alignment: { horizontal: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
    });

    // Grand total row style
    const totalRow = data.length + 5;
    const totalStyle = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FACC15" } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + totalRow];
      if (cell) cell.s = totalStyle;
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "Payment Links");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Log download
    if (user_id) {
      try {
        await supabase.from("download_logs").insert([
          {
            user_id,
            branch: branches,
            report_type: "payment_links",
            downloaded_at: new Date().toISOString(),
          },
        ]);
      } catch (logError) {
        console.error("Failed to log download:", logError);
      }
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Payment_Links_Report_${startDate}_to_${endDate}.xlsx`
    );
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Download Error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/download-status", async (req, res) => {
  try {
    const { data, grandTotals, startDate, endDate, user_id } = req.body;

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "No data to download" });
    }

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Row 1: Title - PAYMENT STATUS
    worksheetData.push([
      "PAYMENT STATUS",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    // Row 2: Location headers
    worksheetData.push([
      "SR NO.",
      "DATE",
      "AHMEDABAD",
      "",
      "CHENNAI",
      "",
      "NOIDA",
      "",
      "TOTAL",
      "",
      "",
    ]);

    // Row 3: Sub headers
    worksheetData.push([
      "",
      "",
      "TOTAL LINK GENRATED",
      "REC AMOUNT",
      "LINK GENRATED",
      "REC AMOUNT",
      "LINK GENRATED",
      "REC AMOUNT",
      "LINK GENRATED",
      "REC AMOUNT",
      "PENDIG",
    ]);

    // Data rows
    data.forEach((row, index) => {
      const date = new Date(row.date);
      const dateStr = `${date.getDate()}-${date.toLocaleString("en-US", {
        month: "short",
      })}`;
      worksheetData.push([
        index + 1,
        dateStr,
        row.ahm_link_generated || 0,
        row.ahm_rec_amount || "",
        row.chennai_link_generated || 0,
        row.chennai_rec_amount || "",
        row.noida_link_generated || 0,
        row.noida_rec_amount || "",
        row.total_link_generated || 0,
        row.total_rec_amount || 0,
        row.pending || 0,
      ]);
    });

    // Grand total row
    worksheetData.push([
      "GRAND TOTAL",
      "",
      grandTotals.ahm_link_generated || 0,
      grandTotals.ahm_rec_amount || 0,
      grandTotals.chennai_link_generated || 0,
      grandTotals.chennai_rec_amount || 0,
      grandTotals.noida_link_generated || 0,
      grandTotals.noida_rec_amount || 0,
      grandTotals.total_link_generated || 0,
      grandTotals.total_rec_amount || 0,
      grandTotals.pending || 0,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Column widths
    worksheet["!cols"] = [
      { wch: 10 }, // SR NO
      { wch: 10 }, // DATE
      { wch: 18 }, // AHM LINK
      { wch: 14 }, // AHM REC
      { wch: 16 }, // CHENNAI LINK
      { wch: 14 }, // CHENNAI REC
      { wch: 16 }, // NOIDA LINK
      { wch: 14 }, // NOIDA REC
      { wch: 16 }, // TOTAL LINK
      { wch: 14 }, // TOTAL REC
      { wch: 14 }, // PENDING
    ];

    // Merges
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Title row
      { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } }, // AHMEDABAD
      { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } }, // CHENNAI
      { s: { r: 1, c: 6 }, e: { r: 1, c: 7 } }, // NOIDA
      { s: { r: 1, c: 8 }, e: { r: 1, c: 10 } }, // TOTAL
      { s: { r: data.length + 3, c: 0 }, e: { r: data.length + 3, c: 1 } }, // Grand Total label
    ];

    // Style definitions
    const greenStyle = {
      font: { bold: true, sz: 12, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "92D050" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    const yellowStyle = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "FFFF00" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    const blueStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "00B0F0" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    const dataStyle = {
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    // Apply title row (row 1) - Green
    const cols = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
    cols.forEach((col) => {
      const cell = worksheet[col + "1"];
      if (cell) cell.s = greenStyle;
    });

    // Apply row 2 styles - SR NO and DATE green, rest yellow
    ["A2", "B2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = greenStyle;
    });
    ["C2", "D2", "E2", "F2", "G2", "H2", "I2", "J2", "K2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = yellowStyle;
    });

    // Apply row 3 styles (sub-headers) - Green
    cols.forEach((col) => {
      const cell = worksheet[col + "3"];
      if (cell) worksheet[col + "3"].s = greenStyle;
    });

    // Apply data row styles (rows 4 to n)
    data.forEach((row, index) => {
      const excelRow = index + 4;
      cols.forEach((col) => {
        const cell = worksheet[col + excelRow];
        if (cell) cell.s = dataStyle;
      });
    });

    // Apply grand total row style - Blue
    const totalRow = data.length + 4;
    cols.forEach((col) => {
      const cell = worksheet[col + totalRow];
      if (cell) cell.s = blueStyle;
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "Payment Status");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    if (user_id) {
      try {
        await supabase.from("download_logs").insert([
          {
            user_id,
            branch: "ALL",
            report_type: "payment_status",
            downloaded_at: new Date().toISOString(),
          },
        ]);
      } catch (logError) {
        console.error("Failed to log download:", logError);
      }
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Payment_Status_Report_${startDate}_to_${endDate}.xlsx`
    );
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Download Status Error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/download-monthly-status", async (req, res) => {
  try {
    const { data, totals, month, year, user_id } = req.body;

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "No data to download" });
    }

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

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Title row
    worksheetData.push([
      `PAYMENT LINK GENERATE REPORT ${monthNames[month - 1]}-${year}`,
    ]);

    // Header row
    worksheetData.push([
      "SR NO",
      "BRANCH",
      "TOTAL LINK GENRATED",
      "REC AMOUNT",
      "PENDING",
    ]);

    // Data rows
    data.forEach((row, index) => {
      worksheetData.push([
        index + 1,
        row.branch,
        row.total_link_generated,
        row.rec_amount,
        row.pending,
      ]);
    });

    // Total row
    worksheetData.push([
      "",
      "TOTAL",
      totals.total_link_generated,
      totals.rec_amount,
      totals.pending,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Column widths
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
    ];

    // Merges
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    // Styles
    const greenStyle = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "92D050" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    const dataStyle = {
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    // Apply styles
    if (worksheet["A1"]) worksheet["A1"].s = greenStyle;
    ["A2", "B2", "C2", "D2", "E2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = greenStyle;
    });

    // Data rows
    for (let i = 0; i < data.length; i++) {
      const row = i + 3;
      ["A", "B", "C", "D", "E"].forEach((col) => {
        const cell = worksheet[col + row];
        if (cell) cell.s = dataStyle;
      });
    }

    // Total row
    const totalRow = data.length + 3;
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + totalRow];
      if (cell) cell.s = greenStyle;
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Report");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    if (user_id) {
      try {
        await supabase.from("download_logs").insert([
          {
            user_id,
            branch: "ALL",
            report_type: "monthly_payment_status",
            downloaded_at: new Date().toISOString(),
          },
        ]);
      } catch (logError) {
        console.error("Failed to log download:", logError);
      }
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Payment_Link_Report_${
        monthNames[month - 1]
      }_${year}.xlsx`
    );
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Download Monthly Status Error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/download-daily-status", async (req, res) => {
  try {
    const { data, totals, date, user_id } = req.body;

    if (!data || data.length === 0) {
      return res.status(400).json({ error: "No data to download" });
    }

    const reportDate = new Date(date);
    const dateStr = `${reportDate
      .getDate()
      .toString()
      .padStart(2, "0")}-${reportDate
      .toLocaleString("en-US", { month: "short" })
      .toUpperCase()}`;

    const workbook = XLSX.utils.book_new();
    const worksheetData = [];

    // Title row
    worksheetData.push([`PAYMENT LINK GENERATE REPORT ${dateStr}`]);

    // Header row
    worksheetData.push([
      "SR NO.",
      "BRANCH",
      "TOTAL LINK GENRATED",
      "REC AMOUNT",
      "PENDING",
    ]);

    // Data rows
    data.forEach((row, index) => {
      worksheetData.push([
        index + 1,
        row.branch,
        row.total_link_generated,
        row.rec_amount,
        row.pending,
      ]);
    });

    // Total row
    worksheetData.push([
      "",
      "TOTAL",
      totals.total_link_generated,
      totals.rec_amount,
      totals.pending,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Column widths
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
    ];

    // Merges
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    // Styles
    const greenStyle = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "92D050" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    const dataStyle = {
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } },
      },
    };

    // Apply styles
    if (worksheet["A1"]) worksheet["A1"].s = greenStyle;
    ["A2", "B2", "C2", "D2", "E2"].forEach((cell) => {
      if (worksheet[cell]) worksheet[cell].s = greenStyle;
    });

    // Data rows
    for (let i = 0; i < data.length; i++) {
      const row = i + 3;
      ["A", "B", "C", "D", "E"].forEach((col) => {
        const cell = worksheet[col + row];
        if (cell) cell.s = dataStyle;
      });
    }

    // Total row
    const totalRow = data.length + 3;
    ["A", "B", "C", "D", "E"].forEach((col) => {
      const cell = worksheet[col + totalRow];
      if (cell) cell.s = greenStyle;
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Report");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    if (user_id) {
      try {
        await supabase.from("download_logs").insert([
          {
            user_id,
            branch: "ALL",
            report_type: "daily_payment_status",
            downloaded_at: new Date().toISOString(),
          },
        ]);
      } catch (logError) {
        console.error("Failed to log download:", logError);
      }
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Payment_Link_Report_${dateStr}.xlsx`
    );
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Download Daily Status Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
