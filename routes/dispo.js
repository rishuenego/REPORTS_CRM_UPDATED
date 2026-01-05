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

    const upperBranch = branch.toUpperCase();

    if (upperBranch === "ALL") {
      // Fetch CRM dispositions from ALL branches (no branch filter)
      const { rows } = await pgConnection.query(
        `SELECT 
          d.name AS disposition
        FROM public.lean_manual_lead AS l
        LEFT JOIN public.dispo_list_name AS d ON l.disposition_id = d.id
        LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
        WHERE h.name IS NOT NULL
          AND DATE(l.write_date) = $1
          AND d.name IS NOT NULL`,
        [reportDate]
      );
      crmDispos = rows;

      const { rows: undisposedRows } = await pgConnection.query(
        `SELECT COUNT(*) AS undisposed_count
        FROM public.lean_manual_lead AS l
        LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
        WHERE h.name IS NOT NULL
          AND DATE(l.write_date) = $1
          AND l.disposition_id IS NULL`,
        [reportDate]
      );
      crmUndisposedCount = Number.parseInt(
        undisposedRows[0]?.undisposed_count || 0
      );
    } else {
      const branchId = getBranchId(upperBranch);

      if (!branchId) {
        pgConnection.release();
        return res.status(400).json({ error: "Invalid branch" });
      }

      const { rows } = await pgConnection.query(
        `SELECT 
          d.name AS disposition
        FROM public.lean_manual_lead AS l
        LEFT JOIN public.dispo_list_name AS d ON l.disposition_id = d.id
        LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
        WHERE h.name IS NOT NULL
          AND h.branch_id = $1
          AND DATE(l.write_date) = $2
          AND d.name IS NOT NULL`,
        [branchId, reportDate]
      );
      crmDispos = rows;

      const { rows: undisposedRows } = await pgConnection.query(
        `SELECT COUNT(*) AS undisposed_count
        FROM public.lean_manual_lead AS l
        LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
        WHERE h.name IS NOT NULL
          AND h.branch_id = $1
          AND DATE(l.write_date) = $2
          AND l.disposition_id IS NULL`,
        [branchId, reportDate]
      );
      crmUndisposedCount = Number.parseInt(
        undisposedRows[0]?.undisposed_count || 0
      );
    }

    pgConnection.release();
    pgConnection = null;

    // Get Dialer dispositions from MySQL
    mysqlConnection = await mysqlPool.getConnection();

    let dialerAnsDispos = [];

    if (upperBranch !== "ALL") {
      // Get employee names for the specific branch from PostgreSQL
      const branchId = getBranchId(upperBranch);
      const pgConn = await pgPool.connect();
      const { rows: employees } = await pgConn.query(
        "SELECT name FROM public.hr_employee WHERE branch_id = $1 ORDER BY id ASC",
        [branchId]
      );
      pgConn.release();

      const employeeNames = employees
        .map((e) => e.name?.toLowerCase())
        .filter(Boolean);

      if (employeeNames.length > 0) {
        const [allDialerAns] = await mysqlConnection.execute(
          `SELECT agent_name, disposition_name FROM call_logs.DialerAns WHERE DATE(createdAt) = ?`,
          [reportDate]
        );

        // Filter by employee names
        dialerAnsDispos = allDialerAns.filter((row) => {
          if (!row.agent_name) return false;
          const agentLower = row.agent_name.toLowerCase();
          return employeeNames.some((name) => agentLower.includes(name));
        });
      }
    } else {
      const [rows] = await mysqlConnection.execute(
        `SELECT disposition_name FROM call_logs.DialerAns WHERE DATE(createdAt) = ?`,
        [reportDate]
      );
      dialerAnsDispos = rows;
    }

    const [dialerUndisposedAns] = await mysqlConnection.execute(
      `SELECT COUNT(*) AS undisposed_count FROM call_logs.DialerAns 
       WHERE DATE(createdAt) = ? AND (disposition_name IS NULL OR TRIM(disposition_name) = '')`,
      [reportDate]
    );

    mysqlConnection.release();
    mysqlConnection = null;

    const dialerUndisposedCount = Number.parseInt(
      dialerUndisposedAns[0]?.undisposed_count || 0
    );

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

    dispoCountsDialer["UNDISPOSED"] = dialerUndisposedCount;

    // Count CRM dispositions
    crmDispos.forEach((row) => {
      const mapped = mapDisposition(row.disposition, "CRM");
      if (dispoCountsCRM[mapped] !== undefined) {
        dispoCountsCRM[mapped]++;
      }
    });

    dispoCountsCRM["UNDISPOSED"] = crmUndisposedCount;

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
              100
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
              100
          )
        : 0;

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

    const branches = ["NOIDA", "AHMEDABAD", "CHENNAI"];
    const branchIds = { NOIDA: 2, AHMEDABAD: 1, CHENNAI: 3 };

    // Initialize data structure
    const branchData = {};
    branches.forEach((branch) => {
      branchData[branch] = {
        dialerCounts: {},
        crmCounts: {},
      };
      DISPO_ORDER.forEach((d) => {
        branchData[branch].dialerCounts[d] = 0;
        branchData[branch].crmCounts[d] = 0;
      });
    });

    pgConnection = await pgPool.connect();
    mysqlConnection = await mysqlPool.getConnection();

    // Fetch data for each branch
    for (const branch of branches) {
      const branchId = branchIds[branch];

      // CRM Data
      const { rows: crmDispos } = await pgConnection.query(
        `SELECT d.name AS disposition
         FROM public.lean_manual_lead AS l
         LEFT JOIN public.dispo_list_name AS d ON l.disposition_id = d.id
         LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
         WHERE h.name IS NOT NULL AND h.branch_id = $1 AND DATE(l.write_date) = $2 AND d.name IS NOT NULL`,
        [branchId, reportDate]
      );

      const { rows: crmUndisposed } = await pgConnection.query(
        `SELECT COUNT(*) AS undisposed_count
         FROM public.lean_manual_lead AS l
         LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
         WHERE h.name IS NOT NULL AND h.branch_id = $1 AND DATE(l.write_date) = $2 AND l.disposition_id IS NULL`,
        [branchId, reportDate]
      );

      // Process CRM dispositions
      crmDispos.forEach((row) => {
        const mapped = mapDisposition(row.disposition, "CRM");
        if (branchData[branch].crmCounts[mapped] !== undefined) {
          branchData[branch].crmCounts[mapped]++;
        }
      });
      branchData[branch].crmCounts["UNDISPOSED"] = Number.parseInt(
        crmUndisposed[0]?.undisposed_count || 0
      );

      // Dialer Data - Get employees for this branch
      const { rows: employees } = await pgConnection.query(
        "SELECT name FROM public.hr_employee WHERE branch_id = $1 ORDER BY id ASC",
        [branchId]
      );
      const employeeNames = employees
        .map((e) => e.name?.toLowerCase())
        .filter(Boolean);

      if (employeeNames.length > 0) {
        const [allDialerAns] = await mysqlConnection.execute(
          `SELECT agent_name, disposition_name FROM call_logs.DialerAns WHERE DATE(createdAt) = ?`,
          [reportDate]
        );

        // Filter by employee names
        const dialerDispos = allDialerAns.filter((row) => {
          if (!row.agent_name) return false;
          const agentLower = row.agent_name.toLowerCase();
          return employeeNames.some((name) => agentLower.includes(name));
        });

        dialerDispos.forEach((row) => {
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

      // Dialer undisposed count
      const [dialerUndisposed] = await mysqlConnection.execute(
        `SELECT COUNT(*) AS undisposed_count FROM call_logs.DialerAns 
         WHERE DATE(createdAt) = ? AND (disposition_name IS NULL OR TRIM(disposition_name) = '')`,
        [reportDate]
      );
      // Note: This is total undisposed, should be distributed or recalculated per branch
    }

    pgConnection.release();
    pgConnection = null;
    mysqlConnection.release();
    mysqlConnection = null;

    // Build merged response data
    const data = DISPO_ORDER.map((dispo) => ({
      DISPO: dispo,
      NOIDA_DIALER: branchData["NOIDA"].dialerCounts[dispo] || 0,
      NOIDA_CRM: branchData["NOIDA"].crmCounts[dispo] || 0,
      AMD_DIALER: branchData["AHMEDABAD"].dialerCounts[dispo] || 0,
      AMD_CRM: branchData["AHMEDABAD"].crmCounts[dispo] || 0,
      CHENNAI_DIALER: branchData["CHENNAI"].dialerCounts[dispo] || 0,
      CHENNAI_CRM: branchData["CHENNAI"].crmCounts[dispo] || 0,
      TOTAL_CALLS:
        (branchData["NOIDA"].dialerCounts[dispo] || 0) +
        (branchData["NOIDA"].crmCounts[dispo] || 0) +
        (branchData["AHMEDABAD"].dialerCounts[dispo] || 0) +
        (branchData["AHMEDABAD"].crmCounts[dispo] || 0) +
        (branchData["CHENNAI"].dialerCounts[dispo] || 0) +
        (branchData["CHENNAI"].crmCounts[dispo] || 0),
    }));

    // Calculate summary for each branch
    const calcBranchSummary = (branch) => {
      let grandDialer = 0,
        grandCRM = 0;
      let ansDialer = 0,
        ansCRM = 0;
      let prospectDialer = 0,
        prospectCRM = 0;

      DISPO_ORDER.forEach((dispo) => {
        const dialerCount = branchData[branch].dialerCounts[dispo] || 0;
        const crmCount = branchData[branch].crmCounts[dispo] || 0;

        grandDialer += dialerCount;
        grandCRM += crmCount;

        if (ANSWERED_CALL_DISPOS.includes(dispo)) {
          ansDialer += dialerCount;
          ansCRM += crmCount;
        }

        if (PROSPECT_DISPOS.includes(dispo)) {
          prospectDialer += dialerCount;
          prospectCRM += crmCount;
        }
      });

      return {
        grandDialer,
        grandCRM,
        ansDialer,
        ansCRM,
        prospectDialer,
        prospectCRM,
        ratioDialer:
          ansDialer > 0 ? Math.round((prospectDialer / ansDialer) * 100) : 0,
        ratioCRM: ansCRM > 0 ? Math.round((prospectCRM / ansCRM) * 100) : 0,
        pickupDialer:
          grandDialer > 0 ? Math.round((ansDialer / grandDialer) * 100) : 0,
        pickupCRM: grandCRM > 0 ? Math.round((ansCRM / grandCRM) * 100) : 0,
      };
    };

    const noidaSummary = calcBranchSummary("NOIDA");
    const amdSummary = calcBranchSummary("AHMEDABAD");
    const chennaiSummary = calcBranchSummary("CHENNAI");

    const totalGrand =
      noidaSummary.grandDialer +
      noidaSummary.grandCRM +
      amdSummary.grandDialer +
      amdSummary.grandCRM +
      chennaiSummary.grandDialer +
      chennaiSummary.grandCRM;
    const totalAns =
      noidaSummary.ansDialer +
      noidaSummary.ansCRM +
      amdSummary.ansDialer +
      amdSummary.ansCRM +
      chennaiSummary.ansDialer +
      chennaiSummary.ansCRM;
    const totalProspect =
      noidaSummary.prospectDialer +
      noidaSummary.prospectCRM +
      amdSummary.prospectDialer +
      amdSummary.prospectCRM +
      chennaiSummary.prospectDialer +
      chennaiSummary.prospectCRM;

    res.json({
      date: reportDate,
      data,
      summary: {
        grandTotal: {
          noida_dialer: noidaSummary.grandDialer,
          noida_crm: noidaSummary.grandCRM,
          amd_dialer: amdSummary.grandDialer,
          amd_crm: amdSummary.grandCRM,
          chennai_dialer: chennaiSummary.grandDialer,
          chennai_crm: chennaiSummary.grandCRM,
          total: totalGrand,
        },
        ansCalls: {
          noida_dialer: noidaSummary.ansDialer,
          noida_crm: noidaSummary.ansCRM,
          amd_dialer: amdSummary.ansDialer,
          amd_crm: amdSummary.ansCRM,
          chennai_dialer: chennaiSummary.ansDialer,
          chennai_crm: chennaiSummary.ansCRM,
          total: totalAns,
        },
        prospect: {
          noida_dialer: noidaSummary.prospectDialer,
          noida_crm: noidaSummary.prospectCRM,
          amd_dialer: amdSummary.prospectDialer,
          amd_crm: amdSummary.prospectCRM,
          chennai_dialer: chennaiSummary.prospectDialer,
          chennai_crm: chennaiSummary.prospectCRM,
          total: totalProspect,
        },
        ratio: {
          noida_dialer: `${noidaSummary.ratioDialer}%`,
          noida_crm: `${noidaSummary.ratioCRM}%`,
          amd_dialer: `${amdSummary.ratioDialer}%`,
          amd_crm: `${amdSummary.ratioCRM}%`,
          chennai_dialer: `${chennaiSummary.ratioDialer}%`,
          chennai_crm: `${chennaiSummary.ratioCRM}%`,
          total:
            totalAns > 0
              ? `${Math.round((totalProspect / totalAns) * 100)}%`
              : "0%",
        },
        pickupRatio: {
          noida_dialer: `${noidaSummary.pickupDialer}%`,
          noida_crm: `${noidaSummary.pickupCRM}%`,
          amd_dialer: `${amdSummary.pickupDialer}%`,
          amd_crm: `${amdSummary.pickupCRM}%`,
          chennai_dialer: `${chennaiSummary.pickupDialer}%`,
          chennai_crm: `${chennaiSummary.pickupCRM}%`,
          total:
            totalGrand > 0
              ? `${Math.round((totalAns / totalGrand) * 100)}%`
              : "0%",
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
