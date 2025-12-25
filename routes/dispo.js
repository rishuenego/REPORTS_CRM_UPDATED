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

    if (branch.toUpperCase() === "ALL") {
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

      // This matches the agent report logic where undisposed means disposition_id IS NULL
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
      // Original branch-specific query
      const getBranchId = (b) => {
        const branchMap = { AHM: 1, NOIDA: 2, CHENNAI: 3 };
        return branchMap[b];
      };
      const branchId = getBranchId(branch.toUpperCase());

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

    // Get Dialer dispositions from MySQL (dialer data is not branch-specific in the original query)
    mysqlConnection = await mysqlPool.getConnection();

    const [dialerAnsDispos] = await mysqlConnection.execute(
      `SELECT disposition_name FROM call_logs.DialerAns WHERE DATE(createdAt) = ?`,
      [reportDate]
    );

    // const [dialerMissedDispos] = await mysqlConnection.execute(
    //   `SELECT disposition_name FROM call_logs.DialerMissed WHERE DATE(createdAt) = ?`,
    //   [reportDate]
    // );

    // This matches the agent report logic
    const [dialerUndisposedAns] = await mysqlConnection.execute(
      `SELECT COUNT(*) AS undisposed_count FROM call_logs.DialerAns 
       WHERE DATE(createdAt) = ? AND (disposition_name IS NULL OR TRIM(disposition_name) = '')`,
      [reportDate]
    );

    const [dialerUndisposedMissed] = await mysqlConnection.execute(
      `SELECT COUNT(*) AS undisposed_count FROM call_logs.DialerMissed 
       WHERE DATE(createdAt) = ? AND (disposition_name IS NULL OR TRIM(disposition_name) = '')`,
      [reportDate]
    );

    mysqlConnection.release();
    mysqlConnection = null;

    const dialerUndisposedCount = Number.parseInt(
      dialerUndisposedAns[0]?.undisposed_count || 0
    );
    // Number.parseInt(dialerUndisposedMissed[0]?.undisposed_count || 0);

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
        // Don't count UNDISPOSED here as we have separate count
        if (
          mapped !== "UNDISPOSED" &&
          dispoCountsDialer[mapped] !== undefined
        ) {
          dispoCountsDialer[mapped]++;
        }
      }
    });

    // dialerMissedDispos.forEach((row) => {
    //   if (row.disposition_name && row.disposition_name.trim() !== "") {
    //     const mapped = mapDisposition(row.disposition_name, "DIALER");
    //     if (
    //       mapped !== "UNDISPOSED" &&
    //       dispoCountsDialer[mapped] !== undefined
    //     ) {
    //       dispoCountsDialer[mapped]++;
    //     }
    //   }
    // });

    // Set undisposed counts from the dedicated queries
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
      branch: branch.toUpperCase() === "ALL" ? "ALL" : branch,
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

export default router;
