import express from "express";
import { pgPool } from "../index.js";

const router = express.Router();

const getBranchId = (branch) => {
  const branchMap = { AHM: 1, NOIDA: 2, CHENNAI: 3 };
  return branchMap[branch.toUpperCase()];
};

const EXCLUDED_EMPLOYEES = [
  // Add names of employees who left the company here (case-insensitive)
  // Example: "John Doe", "Jane Smith"
  "Rahul Sharma",
  "Priya Patel",
  // Add more names as needed
];

const isEmployeeExcluded = (employeeName) => {
  if (!employeeName) return false;
  const nameLower = employeeName.toLowerCase().trim();
  return EXCLUDED_EMPLOYEES.some(
    (excluded) => excluded.toLowerCase().trim() === nameLower
  );
};

router.get("/report/:branch", async (req, res) => {
  try {
    const { branch } = req.params;
    const { month, year } = req.query;
    const branchId = getBranchId(branch);

    if (!branchId) {
      return res.status(400).json({ error: "Invalid branch" });
    }

    const pgConnection = await pgPool.connect();

    const { rows: employees } = await pgConnection.query(
      "SELECT id, name FROM public.hr_employee WHERE branch_id = $1 ORDER BY id ASC",
      [branchId]
    );

    const activeEmployees = employees.filter(
      (emp) => !isEmployeeExcluded(emp.name)
    );

    const pipelineQuery = `
      SELECT 
        u.name as employee_name, 
        c.name as company_name, 
        c.email_normalized as email, 
        c.phone as contact, 
        c.create_date, 
        c.expected_revenue as expected_revenue  
      FROM public.crm_lead as c
      LEFT JOIN res_users as r on c.user_id = r.id
      LEFT JOIN res_partner as u on r.partner_id = u.id
      WHERE EXTRACT(MONTH FROM c.create_date) = $1 AND EXTRACT(YEAR FROM c.create_date) = $2
    `;

    const monthNum = month ? Number.parseInt(month) : new Date().getMonth() + 1;
    const yearNum = year ? Number.parseInt(year) : new Date().getFullYear();

    const { rows: pipelineData } = await pgConnection.query(pipelineQuery, [
      monthNum,
      yearNum,
    ]);

    pgConnection.release();

    const employeeNames = activeEmployees.map((e) => e.name.toLowerCase());

    const filteredData = pipelineData.filter((row) => {
      // First check if this employee is in exclusion list
      if (isEmployeeExcluded(row.employee_name)) {
        return false;
      }

      // Then check if employee belongs to this branch
      return (
        row.employee_name &&
        employeeNames.some((name) =>
          row.employee_name.toLowerCase().includes(name)
        )
      );
    });

    const employeeSummaryMap = new Map();

    activeEmployees.forEach((emp) => {
      employeeSummaryMap.set(emp.name.toLowerCase(), {
        name: emp.name,
        clientCount: 0,
        totalRevenue: 0,
      });
    });

    // Update only those who have data for this month
    filteredData.forEach((row) => {
      if (!row.employee_name) return;

      // Find matching employee
      const empNameLower = row.employee_name.toLowerCase();
      for (const [key, summary] of employeeSummaryMap.entries()) {
        if (empNameLower.includes(key) || key.includes(empNameLower)) {
          summary.clientCount += 1;
          summary.totalRevenue += Number(row.expected_revenue) || 0;
          break;
        }
      }
    });

    // Convert to array and sort by revenue descending
    const summary = Array.from(employeeSummaryMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    );

    // Calculate grand totals
    let totalClients = 0;
    let totalRevenue = 0;

    summary.forEach((emp) => {
      totalClients += emp.clientCount;
      totalRevenue += emp.totalRevenue;
    });

    res.json({
      branch,
      month: monthNum,
      year: yearNum,
      data: filteredData,
      summary,
      grandTotals: {
        totalClients,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Error fetching pipeline report:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
