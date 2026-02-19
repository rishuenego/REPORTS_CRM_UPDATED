import express from "express";
import { mysqlPool, pgPool } from "../index.js";

const router = express.Router();

// Disposition mapping from provided logic
const DISPO_MAPPING = {
  CRM: {
    INTERESTED: "INTERESTED",
    BUSY: "BUSY",
    "CALL BACK": "CALL BACK",
    INTRO: "INTRODUCTION",
    "LANGUAGE ISSUE": "LANGUAGE ISSUE",
    "NEED UPDATE": "NEED UPDATE",
    "NOT INTERESTED": "NOT INTERESTED",
    "NOT PICKUP": "NOT PICKUP",
    SCRAP: "SCRAP",
    "WRONG NUMBER": "SCRAP",
    "VOICE MAIL": "NOT PICKUP",
    DND: "OTHER",
    "ALREADY PAID": "ALREADY PAID",
    "VOICE ISSUE": "VOICE ISSUE",
    VIS: "VOICE ISSUE",
  },
  DIALER: {
    SCRAP: "SCRAP",
    "VOICE MAIL": "NOT PICKUP",
    VCM: "NOT PICKUP",
    DND: "OTHER",
    "ALREADY PAID": "ALREADY PAID",
    ALDPA: "ALREADY PAID",
    "WRONG NUMBER": "SCRAP",
    WRNUM: "SCRAP",
    "NOT PICKUP": "NOT PICKUP",
    NTPIC: "NOT PICKUP",
    "RING TIMEOUT": "NOT PICKUP",
    "RECEIVER IS BUSY": "NOT PICKUP",
    "CALL REJECTED": "NOT PICKUP",
    "CHANNEL ISSUE": "NOT PICKUP",
    "ISSUE WITH RECEIVER NETWORK": "NOT PICKUP",
    "NETWORK ISSUE": "NOT PICKUP",
    NOANS: "NOT PICKUP",
    "NOT REACHABLE": "NOT PICKUP",
    "SYSTEM FAILURE": "NOT PICKUP",
    "UNALLOCATED NUMBER": "SCRAP",
    "INVALID DIALING": "SCRAP",
    "INVALID NUM": "SCRAP",
    QOS: "OTHER",
    "NOT INTERESTED": "NOT INTERESTED",
    NOTIN: "NOT INTERESTED",
    ANSWERED: "NOT INTERESTED",
    "NEED UPDATE": "NEED UPDATE",
    NEEUP: "NEED UPDATE",
    "LANGUAGE ISSUE": "LANGUAGE ISSUE",
    LANIS: "LANGUAGE ISSUE",
    INTRO: "INTRODUCTION",
    INTRODUCTION: "INTRODUCTION",
    INTERESTED: "INTERESTED",
    INT: "INTERESTED",
    "CALL BACK": "CALL BACK",
    CAB: "CALL BACK",
    BUSY: "BUSY",
    BUS: "BUSY",
    OTHER: "OTHER",
    UNDISPOSED: "UNDISPOSED",
    "VOICE ISSUE": "VOICE ISSUE",
    VIS: "VOICE ISSUE",
  },
};

const ANSWERED_CALL_DISPOS = [
  "CALL BACK",
  "ALREADY PAID",
  "INTERESTED",
  "INTRODUCTION",
  "LANGUAGE ISSUE",
  "NEED UPDATE",
  "NOT INTERESTED",
  "VOICE ISSUE",
];

const PROSPECT_DISPOS = ["INTERESTED", "INTRODUCTION"];

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

const mapDisposition = (dispo, source) => {
  if (!dispo) return "UNDISPOSED";
  const upperDispo = dispo.toUpperCase().trim();
  const mapping = DISPO_MAPPING[source];
  return mapping[upperDispo] || "OTHER";
};

const getBranchId = (branch) => {
  const branchMap = { AHM: 1, AHMEDABAD: 1, NOIDA: 2, CHENNAI: 3 };
  return branchMap[branch?.toUpperCase()];
};

router.get("/report/:branch", async (req, res) => {
  let pgConnection = null;
  let mysqlConnection = null;

  try {
    const { branch } = req.params;
    const { date } = req.query;

    const reportDate = date || new Date().toISOString().split("T")[0];

    pgConnection = await pgPool.connect();

    let crmDispos;
    let crmUndisposedCount = 0;
    const crmAgentNames = new Set();

    const upperBranch = branch.toUpperCase();

    if (upperBranch === "ALL") {
      // Fetch CRM dispositions from ALL branches (no branch filter)
      const { rows } = await pgConnection.query(
        `SELECT
          d.name AS disposition,
          h.name AS agent_name
        FROM public.lean_manual_lead AS l
        LEFT JOIN public.dispo_list_name AS d ON l.disposition_id = d.id
        LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
        WHERE h.name IS NOT NULL
          AND DATE(l.write_date) = $1
          AND d.name IS NOT NULL`,
        [reportDate],
      );
      crmDispos = rows;
      rows.forEach((row) => {
        if (row.agent_name)
          crmAgentNames.add(row.agent_name.toLowerCase().trim());
      });

      // const { rows: undisposedRows } = await pgConnection.query(
      //   `SELECT COUNT(*) AS undisposed_count
      //   FROM public.lean_manual_lead AS l
      //   LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
      //   WHERE h.name IS NOT NULL
      //     AND DATE(l.write_date) = $1
      //     AND l.disposition_id IS NULL`,
      //   [reportDate]
      // );
      // crmUndisposedCount = Number.parseInt(
      //   undisposedRows[0]?.undisposed_count || 0
      // );
    } else {
      const branchId = getBranchId(upperBranch);

      if (!branchId) {
        pgConnection.release();
        return res.status(400).json({ error: "Invalid branch" });
      }

      const { rows } = await pgConnection.query(
        `SELECT
          d.name AS disposition,
          h.name AS agent_name
        FROM public.lean_manual_lead AS l
        LEFT JOIN public.dispo_list_name AS d ON l.disposition_id = d.id
        LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
        WHERE h.name IS NOT NULL
          AND h.branch_id = $1
          AND DATE(l.write_date) = $2
          AND d.name IS NOT NULL`,
        [branchId, reportDate],
      );
      crmDispos = rows;
      rows.forEach((row) => {
        if (row.agent_name)
          crmAgentNames.add(row.agent_name.toLowerCase().trim());
      });

      // const { rows: undisposedRows } = await pgConnection.query(
      //   `SELECT COUNT(*) AS undisposed_count
      //   FROM public.lean_manual_lead AS l
      //   LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
      //   WHERE h.name IS NOT NULL
      //     AND h.branch_id = $1
      //     AND DATE(l.write_date) = $2
      //     AND l.disposition_id IS NULL`,
      //   [branchId, reportDate]
      // );
      // crmUndisposedCount = Number.parseInt(
      //   undisposedRows[0]?.undisposed_count || 0
      // );
    }

    // Get Dialer dispositions from MySQL
    mysqlConnection = await mysqlPool.getConnection();

    let dialerAnsDispos = [];
    const dialerAgentNames = new Set();

    if (upperBranch !== "ALL") {
      // Get employee names for the specific branch from PostgreSQL
      const branchId = getBranchId(upperBranch);
      const { rows: employees } = await pgConnection.query(
        "SELECT name FROM public.hr_employee WHERE branch_id = $1 ORDER BY id ASC",
        [branchId],
      );

      const employeeNames = employees
        .map((e) => e.name?.toLowerCase())
        .filter(Boolean);

      if (employeeNames.length > 0) {
        const [allDialerAns] = await mysqlConnection.execute(
          `SELECT agent_name, disposition_name FROM call_logs.DialerAns WHERE DATE(createdAt) = ?`,
          [reportDate],
        );

        // Filter by employee names
        dialerAnsDispos = allDialerAns.filter((row) => {
          if (!row.agent_name) return false;
          const agentLower = row.agent_name.toLowerCase();
          const matched = employeeNames.some((name) =>
            agentLower.includes(name),
          );
          if (matched) {
            dialerAgentNames.add(agentLower.trim());
          }
          return matched;
        });
      }
    } else {
      // For ALL branch: Use the same logic as merged report - filter by ALL known employees from ALL branches
      // This ensures NORMAL ALL report data matches MERGED report TOTAL_CALLS
      const { rows: allEmployees } = await pgConnection.query(
        "SELECT name FROM public.hr_employee WHERE branch_id IN (1, 2, 3) ORDER BY id ASC",
      );

      const allEmployeeNames = allEmployees
        .map((e) => e.name?.toLowerCase())
        .filter(Boolean);

      const [allDialerAns] = await mysqlConnection.execute(
        `SELECT agent_name, disposition_name FROM call_logs.DialerAns WHERE DATE(createdAt) = ?`,
        [reportDate],
      );

      // Filter by ALL employee names from ALL branches (same logic as merged report)
      dialerAnsDispos = allDialerAns.filter((row) => {
        if (!row.agent_name) return false;
        const agentLower = row.agent_name.toLowerCase();
        const matched = allEmployeeNames.some((name) =>
          agentLower.includes(name),
        );
        if (matched) {
          dialerAgentNames.add(agentLower.trim());
        }
        return matched;
      });
    }

    pgConnection.release();
    pgConnection = null;

    mysqlConnection.release();
    mysqlConnection = null;

    // Process and aggregate dispositions
    const dispoCountsDialer = {};
    const dispoCountsCRM = {};

    // Initialize all dispositions
    DISPO_ORDER.forEach((d) => {
      dispoCountsDialer[d] = 0;
      dispoCountsCRM[d] = 0;
    });

    dialerAnsDispos.forEach((row) => {
      if (row.disposition_name && row.disposition_name.trim() !== "") {
        const mapped = mapDisposition(row.disposition_name, "DIALER");
        if (
          mapped !== "UNDISPOSED" &&
          dispoCountsDialer[mapped] !== undefined
        ) {
          dispoCountsDialer[mapped]++;
        }
      }
    });

    // Note: UNDISPOSED is not counted for branch-filtered data to match merged report
    // dispoCountsDialer["UNDISPOSED"] = dialerUndisposedCount;

    // Count CRM dispositions
    crmDispos.forEach((row) => {
      const mapped = mapDisposition(row.disposition, "CRM");
      if (dispoCountsCRM[mapped] !== undefined) {
        dispoCountsCRM[mapped]++;
      }
    });

    // dispoCountsCRM["UNDISPOSED"] = crmUndisposedCount;

    // Build response data
    const data = DISPO_ORDER.map((dispo) => ({
      DISPO: dispo,
      DIALER_CALLS: dispoCountsDialer[dispo] || 0,
      CRM_CALLS: dispoCountsCRM[dispo] || 0,
      TOTAL_CALLS:
        (dispoCountsDialer[dispo] || 0) + (dispoCountsCRM[dispo] || 0),
    }));

    // Calculate summary
    let grandTotalDialer = 0;
    let grandTotalCRM = 0;
    let ansCallsDialer = 0;
    let ansCallsCRM = 0;
    let prospectDialer = 0;
    let prospectCRM = 0;

    data.forEach((row) => {
      grandTotalDialer += row.DIALER_CALLS;
      grandTotalCRM += row.CRM_CALLS;

      if (ANSWERED_CALL_DISPOS.includes(row.DISPO)) {
        ansCallsDialer += row.DIALER_CALLS;
        ansCallsCRM += row.CRM_CALLS;
      }

      if (PROSPECT_DISPOS.includes(row.DISPO)) {
        prospectDialer += row.DIALER_CALLS;
        prospectCRM += row.CRM_CALLS;
      }
    });

    // Calculate ratios
    const ratioDialer =
      ansCallsDialer > 0
        ? Math.round((prospectDialer / ansCallsDialer) * 100)
        : 0;
    const ratioCRM =
      ansCallsCRM > 0 ? Math.round((prospectCRM / ansCallsCRM) * 100) : 0;
    const ratioTotal =
      ansCallsDialer + ansCallsCRM > 0
        ? Math.round(
            ((prospectDialer + prospectCRM) / (ansCallsDialer + ansCallsCRM)) *
              100,
          )
        : 0;

    // Calculate pickup ratio (answered / total)
    const pickupRatioDialer =
      grandTotalDialer > 0
        ? Math.round((ansCallsDialer / grandTotalDialer) * 100)
        : 0;
    const pickupRatioCRM =
      grandTotalCRM > 0 ? Math.round((ansCallsCRM / grandTotalCRM) * 100) : 0;
    const pickupRatioTotal =
      grandTotalDialer + grandTotalCRM > 0
        ? Math.round(
            ((ansCallsDialer + ansCallsCRM) /
              (grandTotalDialer + grandTotalCRM)) *
              100,
          )
        : 0;

    const allUniqueAgents = new Set([...crmAgentNames, ...dialerAgentNames]);
    const uniqueAgentsCount = allUniqueAgents.size;

    res.json({
      branch: upperBranch,
      date: reportDate,
      data,
      summary: {
        grandTotal: {
          dialer: grandTotalDialer,
          crm: grandTotalCRM,
          total: grandTotalDialer + grandTotalCRM,
        },
        ansCalls: {
          dialer: ansCallsDialer,
          crm: ansCallsCRM,
          total: ansCallsDialer + ansCallsCRM,
        },
        prospect: {
          dialer: prospectDialer,
          crm: prospectCRM,
          total: prospectDialer + prospectCRM,
        },
        ratio: {
          dialer: `${ratioDialer}%`,
          crm: `${ratioCRM}%`,
          total: `${ratioTotal}%`,
        },
        pickupRatio: {
          dialer: `${pickupRatioDialer}%`,
          crm: `${pickupRatioCRM}%`,
          total: `${pickupRatioTotal}%`,
        },
        uniqueAgents: uniqueAgentsCount,
      },
    });
  } catch (error) {
    console.error("Dispo Report Error:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  } finally {
    if (pgConnection) {
      try {
        pgConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.get("/merged-report", async (req, res) => {
  let pgConnection = null;
  let mysqlConnection = null;

  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split("T")[0];

    const branches = ["AHMEDABAD", "CHENNAI", "NOIDA"];
    const branchIds = { NOIDA: 2, AHMEDABAD: 1, CHENNAI: 3 };

    const branchData = {};
    branches.forEach((branch) => {
      branchData[branch] = {
        dialerCounts: {},
        crmCounts: {},
        crmAgentNames: new Set(),
        dialerAgentNames: new Set(),
      };
      DISPO_ORDER.forEach((d) => {
        branchData[branch].dialerCounts[d] = 0;
        branchData[branch].crmCounts[d] = 0;
      });
    });

    pgConnection = await pgPool.connect();
    mysqlConnection = await mysqlPool.getConnection();

    // Process each branch using the SAME logic as the normal report endpoint
    for (const branch of branches) {
      const branchId = branchIds[branch];

      // Get CRM dispositions for this branch (same query as normal report)
      const { rows: crmDispos } = await pgConnection.query(
        `SELECT
          d.name AS disposition,
          h.name AS agent_name
        FROM public.lean_manual_lead AS l
        LEFT JOIN public.dispo_list_name AS d ON l.disposition_id = d.id
        LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
        WHERE h.name IS NOT NULL
          AND h.branch_id = $1
          AND DATE(l.write_date) = $2
          AND d.name IS NOT NULL`,
        [branchId, reportDate],
      );

      // Count CRM dispositions (same logic as normal report)
      crmDispos.forEach((row) => {
        const mapped = mapDisposition(row.disposition, "CRM");
        if (branchData[branch].crmCounts[mapped] !== undefined) {
          branchData[branch].crmCounts[mapped]++;
        }
        if (row.agent_name) {
          branchData[branch].crmAgentNames.add(
            row.agent_name.toLowerCase().trim(),
          );
        }
      });

      // Get employee names for this branch (same as normal report)
      const { rows: employees } = await pgConnection.query(
        "SELECT name FROM public.hr_employee WHERE branch_id = $1 ORDER BY id ASC",
        [branchId],
      );

      const employeeNames = employees
        .map((e) => e.name?.toLowerCase())
        .filter(Boolean);

      if (employeeNames.length > 0) {
        // Get ALL dialer data for the date (same query as normal report)
        const [allDialerAns] = await mysqlConnection.execute(
          `SELECT agent_name, disposition_name FROM call_logs.DialerAns WHERE DATE(createdAt) = ?`,
          [reportDate],
        );

        // Filter by employee names (same logic as normal report)
        const dialerAnsDispos = allDialerAns.filter((row) => {
          if (!row.agent_name) return false;
          const agentLower = row.agent_name.toLowerCase();
          const matched = employeeNames.some((name) =>
            agentLower.includes(name),
          );
          if (matched) {
            branchData[branch].dialerAgentNames.add(agentLower.trim());
          }
          return matched;
        });

        // Count dialer dispositions (same logic as normal report)
        dialerAnsDispos.forEach((row) => {
          if (row.disposition_name && row.disposition_name.trim() !== "") {
            const mapped = mapDisposition(row.disposition_name, "DIALER");
            if (
              mapped !== "UNDISPOSED" &&
              branchData[branch].dialerCounts[mapped] !== undefined
            ) {
              branchData[branch].dialerCounts[mapped]++;
            }
          }
        });
      }

      // Get dialer undisposed count for this branch
      const [dialerUndisposedAns] = await mysqlConnection.execute(
        `SELECT COUNT(*) AS undisposed_count FROM call_logs.DialerAns
         WHERE DATE(createdAt) = ? AND (disposition_name IS NULL OR TRIM(disposition_name) = '')`,
        [reportDate],
      );

      // Note: We don't add undisposed to branch counts as it's global and would be duplicated
      // The normal report also has this issue - undisposed is counted globally, not per branch
    }

    pgConnection.release();
    pgConnection = null;
    mysqlConnection.release();
    mysqlConnection = null;

    // Build merged response data
    const data = DISPO_ORDER.map((dispo) => ({
      DISPO: dispo,
      AHMEDABAD:
        (branchData["AHMEDABAD"].dialerCounts[dispo] || 0) +
        (branchData["AHMEDABAD"].crmCounts[dispo] || 0),
      CHENNAI:
        (branchData["CHENNAI"].dialerCounts[dispo] || 0) +
        (branchData["CHENNAI"].crmCounts[dispo] || 0),
      NOIDA:
        (branchData["NOIDA"].dialerCounts[dispo] || 0) +
        (branchData["NOIDA"].crmCounts[dispo] || 0),
      TOTAL_CALLS:
        (branchData["AHMEDABAD"].dialerCounts[dispo] || 0) +
        (branchData["AHMEDABAD"].crmCounts[dispo] || 0) +
        (branchData["CHENNAI"].dialerCounts[dispo] || 0) +
        (branchData["CHENNAI"].crmCounts[dispo] || 0) +
        (branchData["NOIDA"].dialerCounts[dispo] || 0) +
        (branchData["NOIDA"].crmCounts[dispo] || 0),
    }));

    const calcBranchSummary = (branch) => {
      let grand = 0;
      let ans = 0;
      let prospect = 0;

      DISPO_ORDER.forEach((dispo) => {
        const total =
          (branchData[branch].dialerCounts[dispo] || 0) +
          (branchData[branch].crmCounts[dispo] || 0);
        grand += total;

        if (ANSWERED_CALL_DISPOS.includes(dispo)) {
          ans += total;
        }

        if (PROSPECT_DISPOS.includes(dispo)) {
          prospect += total;
        }
      });

      // Combine unique agents from both CRM and Dialer
      const allAgents = new Set([
        ...branchData[branch].crmAgentNames,
        ...branchData[branch].dialerAgentNames,
      ]);

      return {
        grand,
        ans,
        prospect,
        ratio: ans > 0 ? Math.round((prospect / ans) * 100) : 0,
        pickupRatio: grand > 0 ? Math.round((ans / grand) * 100) : 0,
        uniqueAgents: allAgents.size,
      };
    };

    const noidaSummary = calcBranchSummary("NOIDA");
    const amdSummary = calcBranchSummary("AHMEDABAD");
    const chennaiSummary = calcBranchSummary("CHENNAI");

    const totalGrand =
      noidaSummary.grand + amdSummary.grand + chennaiSummary.grand;
    const totalAns = noidaSummary.ans + amdSummary.ans + chennaiSummary.ans;
    const totalProspect =
      noidaSummary.prospect + amdSummary.prospect + chennaiSummary.prospect;
    const allUniqueAgents = new Set([
      ...branchData["AHMEDABAD"].crmAgentNames,
      ...branchData["AHMEDABAD"].dialerAgentNames,
      ...branchData["CHENNAI"].crmAgentNames,
      ...branchData["CHENNAI"].dialerAgentNames,
      ...branchData["NOIDA"].crmAgentNames,
      ...branchData["NOIDA"].dialerAgentNames,
    ]);
    const totalUniqueAgents = allUniqueAgents.size;

    res.json({
      date: reportDate,
      data,
      summary: {
        grandTotal: {
          ahmedabad: amdSummary.grand,
          chennai: chennaiSummary.grand,
          noida: noidaSummary.grand,
          total: totalGrand,
        },
        ansCalls: {
          ahmedabad: amdSummary.ans,
          chennai: chennaiSummary.ans,
          noida: noidaSummary.ans,
          total: totalAns,
        },
        prospect: {
          ahmedabad: amdSummary.prospect,
          chennai: chennaiSummary.prospect,
          noida: noidaSummary.prospect,
          total: totalProspect,
        },
        ratio: {
          ahmedabad: `${amdSummary.ratio}%`,
          chennai: `${chennaiSummary.ratio}%`,
          noida: `${noidaSummary.ratio}%`,
          total:
            totalAns > 0
              ? `${Math.round((totalProspect / totalAns) * 100)}%`
              : "0%",
        },
        pickupRatio: {
          ahmedabad: `${amdSummary.pickupRatio}%`,
          chennai: `${chennaiSummary.pickupRatio}%`,
          noida: `${noidaSummary.pickupRatio}%`,
          total:
            totalGrand > 0
              ? `${Math.round((totalAns / totalGrand) * 100)}%`
              : "0%",
        },
        uniqueAgents: {
          ahmedabad: amdSummary.uniqueAgents,
          chennai: chennaiSummary.uniqueAgents,
          noida: noidaSummary.uniqueAgents,
          total: totalUniqueAgents,
        },
      },
    });
  } catch (error) {
    console.error("Merged Dispo Report Error:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  } finally {
    if (pgConnection) {
      try {
        pgConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

export default router;
