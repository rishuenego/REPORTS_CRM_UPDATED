import express from "express";
import { mysqlPool, pgPool } from "../index.js";

const router = express.Router();

const getBranchId = (branch) => {
  const branchMap = { AHM: 1, NOIDA: 2, CHENNAI: 3 };
  return branchMap[branch];
};

// Disposition mapping
const DISPO_MAPPING_DIALER = {
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
};

const DISPO_MAPPING_CRM = {
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
  const mapping =
    source === "DIALER" ? DISPO_MAPPING_DIALER : DISPO_MAPPING_CRM;
  return mapping[upperDispo] || "OTHER";
};

router.get("/list/:branch", async (req, res) => {
  let pgConnection = null;

  try {
    const { branch } = req.params;
    const branchId = getBranchId(branch.toUpperCase());

    if (!branchId) {
      return res.status(400).json({ error: "Invalid branch" });
    }

    pgConnection = await pgPool.connect();
    const { rows: employees } = await pgConnection.query(
      "SELECT name FROM public.hr_employee WHERE branch_id = $1 ORDER BY name ASC",
      [branchId]
    );
    pgConnection.release();
    pgConnection = null;

    const agents = employees.map((e) => e.name).filter(Boolean);

    res.json({ agents });
  } catch (error) {
    console.error("Agent List Error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (pgConnection) {
      try {
        pgConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

// Original report endpoint (kept for backward compatibility)
router.get("/report", async (req, res) => {
  let mysqlConnection = null;

  try {
    const { agentName, branch, startDate, endDate } = req.query;

    if (!agentName || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    mysqlConnection = await mysqlPool.getConnection();

    const [rows] = await mysqlConnection.execute(
      `
      SELECT
          DATE(combined.date) AS DATE,
          SUM(ans_calls) AS ANS_CALLS,
          SUM(missed_calls) AS MISSED_CALLS,
          SUM(total_calls) AS TOTAL_CALLS,
          SEC_TO_TIME(SUM(total_duration)) AS TALK_TIME,
          SUM(prospect_count) AS PROSPECT
      FROM (
          SELECT
              DATE(createdAt) AS date,
              COUNT(*) AS ans_calls,
              0 AS missed_calls,
              COUNT(*) AS total_calls,
              SUM(duration) AS total_duration,
              SUM(CASE WHEN LOWER(disposition_name) IN ('interested', 'intro', 'dnd') THEN 1 ELSE 0 END) AS prospect_count
          FROM call_logs.DialerAns
          WHERE agent_name LIKE ?
            AND DATE(createdAt) BETWEEN ? AND ?
          GROUP BY DATE(createdAt)

          UNION ALL

          SELECT
              DATE(createdAt) AS date,
              0 AS ans_calls,
              COUNT(*) AS missed_calls,
              COUNT(*) AS total_calls,
              SUM(duration) AS total_duration,
              0 AS prospect_count
          FROM call_logs.DialerMissed
          WHERE agent_name LIKE ?
            AND DATE(createdAt) BETWEEN ? AND ?
          GROUP BY DATE(createdAt)
      ) AS combined
      GROUP BY DATE(combined.date)
      ORDER BY DATE(combined.date) DESC
    `,
      [
        `%${agentName}%`,
        startDate,
        endDate,
        `%${agentName}%`,
        startDate,
        endDate,
      ]
    );

    mysqlConnection.release();
    mysqlConnection = null;

    let grandTotalCalls = 0;
    let grandMissedCalls = 0;
    let grandTotalCallsCount = 0;
    let grandTotalDuration = 0;
    let grandProspect = 0;

    const formattedData = rows.map((row) => {
      grandTotalCalls += Number(row.ANS_CALLS) || 0;
      grandMissedCalls += Number(row.MISSED_CALLS) || 0;
      grandTotalCallsCount += Number(row.TOTAL_CALLS) || 0;
      grandProspect += Number(row.PROSPECT) || 0;

      if (row.TALK_TIME && typeof row.TALK_TIME === "string") {
        const timeParts = row.TALK_TIME.split(":");
        if (timeParts.length === 3) {
          grandTotalDuration +=
            Number.parseInt(timeParts[0]) * 3600 +
            Number.parseInt(timeParts[1]) * 60 +
            Number.parseInt(timeParts[2]);
        }
      }

      return {
        NAME: agentName,
        DATE: row.DATE,
        ANS_CALLS: row.ANS_CALLS,
        MISSED_CALLS: row.MISSED_CALLS,
        TOTAL_CALLS: row.TOTAL_CALLS,
        TALK_TIME: row.TALK_TIME,
        PROSPECT: row.PROSPECT,
      };
    });

    const hours = Math.floor(grandTotalDuration / 3600);
    const minutes = Math.floor((grandTotalDuration % 3600) / 60);
    const seconds = grandTotalDuration % 60;
    const grandTotalTalkTime = `${hours}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;

    res.json({
      agentName,
      data: formattedData,
      grandTotals: {
        ansCalls: grandTotalCalls,
        missedCalls: grandMissedCalls,
        totalCalls: grandTotalCallsCount,
        talkTime: grandTotalTalkTime,
        prospect: grandProspect,
      },
    });
  } catch (error) {
    console.error("Agent Report Error:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  } finally {
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

// New disposition report endpoint for agent
router.get("/dispo-report", async (req, res) => {
  let pgConnection = null;
  let mysqlConnection = null;

  try {
    const { agentName, startDate, endDate } = req.query;

    if (!agentName || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Initialize disposition counts
    const dispoCountsDialer = {};
    const dispoCountsCRM = {};

    DISPO_ORDER.forEach((d) => {
      dispoCountsDialer[d] = 0;
      dispoCountsCRM[d] = 0;
    });

    // Get Dialer dispositions from MySQL
    mysqlConnection = await mysqlPool.getConnection();

    const [dialerAnsDispos] = await mysqlConnection.execute(
      `SELECT disposition_name FROM call_logs.DialerAns 
       WHERE agent_name LIKE ? AND DATE(createdAt) BETWEEN ? AND ?`,
      [`%${agentName}%`, startDate, endDate]
    );

    const [dialerMissedDispos] = await mysqlConnection.execute(
      `SELECT disposition_name FROM call_logs.DialerMissed 
       WHERE agent_name LIKE ? AND DATE(createdAt) BETWEEN ? AND ?`,
      [`%${agentName}%`, startDate, endDate]
    );

    mysqlConnection.release();
    mysqlConnection = null;

    // Count Dialer dispositions
    dialerAnsDispos.forEach((row) => {
      const mapped = mapDisposition(row.disposition_name, "DIALER");
      if (dispoCountsDialer[mapped] !== undefined) {
        dispoCountsDialer[mapped]++;
      }
    });

    dialerMissedDispos.forEach((row) => {
      const mapped = mapDisposition(row.disposition_name, "DIALER");
      if (dispoCountsDialer[mapped] !== undefined) {
        dispoCountsDialer[mapped]++;
      }
    });

    // Get CRM dispositions from PostgreSQL
    pgConnection = await pgPool.connect();
    const { rows: crmDispos } = await pgConnection.query(
      `SELECT d.name AS disposition
       FROM public.lean_manual_lead AS l
       LEFT JOIN public.dispo_list_name AS d ON l.disposition_id = d.id
       LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
       WHERE d.name IS NOT NULL
         AND h.name ILIKE $1
         AND DATE(l.write_date) BETWEEN $2 AND $3`,
      [`%${agentName}%`, startDate, endDate]
    );
    pgConnection.release();
    pgConnection = null;

    // Count CRM dispositions
    crmDispos.forEach((row) => {
      const mapped = mapDisposition(row.disposition, "CRM");
      if (dispoCountsCRM[mapped] !== undefined) {
        dispoCountsCRM[mapped]++;
      }
    });

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

    res.json({
      agentName,
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
      },
    });
  } catch (error) {
    console.error("Agent Dispo Report Error:", error.message, error.stack);
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
