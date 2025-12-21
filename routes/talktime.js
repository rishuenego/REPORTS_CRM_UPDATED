import express from "express";
import { mysqlPool, pgPool } from "../index.js";

const router = express.Router();

const getBranchId = (branch) => {
  const branchMap = { AHM: 1, NOIDA: 2, CHENNAI: 3 };
  return branchMap[branch];
};

// Prospect dispositions for CRM
const CRM_PROSPECT_DISPOS = ["INTERESTED", "INTRO", "INTRODUCTION"];

router.get("/report/:branch", async (req, res) => {
  let pgConnection = null;
  let mysqlConnection = null;

  try {
    const { branch } = req.params;
    const { date, reportType = "DIALER" } = req.query;
    const branchId = getBranchId(branch.toUpperCase());

    if (!branchId) {
      return res.status(400).json({ error: "Invalid branch" });
    }

    if (!pgPool) {
      return res.status(500).json({ error: "PostgreSQL pool not initialized" });
    }

    pgConnection = await pgPool.connect();
    const { rows: employees } = await pgConnection.query(
      "SELECT id, name, user_id FROM public.hr_employee WHERE branch_id = $1 ORDER BY id ASC",
      [branchId]
    );

    const employeeNames = employees.map((e) => e.name);
    const employeeUserIds = employees.map((e) => e.user_id).filter(Boolean);
    const reportDate = date || new Date().toISOString().split("T")[0];

    let dialerData = [];
    let crmData = [];

    // Fetch Dialer data if needed
    if (reportType === "DIALER" || reportType === "MASTER") {
      if (!mysqlPool) {
        pgConnection.release();
        return res.status(500).json({ error: "MySQL pool not initialized" });
      }

      mysqlConnection = await mysqlPool.getConnection();

      const [rows] = await mysqlConnection.execute(
        `
        SELECT
            agent_name AS NAME,
            SUM(ans_calls) AS ANS_CALLS,
            SUM(missed_calls) AS MISSED_CALLS,
            SUM(total_calls) AS TOTAL_CALLS,
            SEC_TO_TIME(SUM(total_duration)) AS TALK_TIME,
            SUM(prospect_count) AS PROSPECT
        FROM (
            SELECT
                agent_name,
                COUNT(*) AS ans_calls,
                0 AS missed_calls,
                COUNT(*) AS total_calls,
                SUM(duration) AS total_duration,
                SUM(CASE WHEN LOWER(disposition_name) IN ('interested', 'intro', 'introduction', 'int') THEN 1 ELSE 0 END) AS prospect_count
            FROM call_logs.DialerAns
            WHERE DATE(createdAt) = ?
            GROUP BY agent_name

            UNION ALL

            SELECT
                agent_name,
                0 AS ans_calls,
                COUNT(*) AS missed_calls,
                COUNT(*) AS total_calls,
                SUM(duration) AS total_duration,
                0 AS prospect_count
            FROM call_logs.DialerMissed
            WHERE DATE(createdAt) = ?
            GROUP BY agent_name
        ) AS combined
        GROUP BY agent_name
        ORDER BY SUM(total_duration) DESC
      `,
        [reportDate, reportDate]
      );

      mysqlConnection.release();
      mysqlConnection = null;

      dialerData = rows.filter((row) => {
        if (!row.NAME) return false;
        return employeeNames.some((name) => {
          if (!name) return false;
          return row.NAME.toLowerCase().includes(name.toLowerCase());
        });
      });
    }

    // Fetch CRM data if needed
    if (reportType === "CRM" || reportType === "MASTER") {
      const { rows: crmRows } = await pgConnection.query(
        `SELECT 
          h.name AS employee_name,
          COUNT(*) AS calls,
          SUM(CASE WHEN UPPER(d.name) IN ('INTERESTED', 'INTRO', 'INTRODUCTION') THEN 1 ELSE 0 END) AS prospect
        FROM public.lean_manual_lead AS l
        LEFT JOIN public.dispo_list_name AS d ON l.disposition_id = d.id
        LEFT JOIN public.hr_employee AS h ON h.user_id = l.employee_id
        WHERE d.name IS NOT NULL
          AND h.name IS NOT NULL
          AND h.branch_id = $1
          AND DATE(l.write_date) = $2
        GROUP BY h.name
        ORDER BY COUNT(*) DESC`,
        [branchId, reportDate]
      );

      crmData = crmRows.map((row) => ({
        NAME: row.employee_name,
        CRM_CALLS: Number.parseInt(row.calls) || 0,
        CRM_PROSPECT: Number.parseInt(row.prospect) || 0,
      }));
    }

    pgConnection.release();
    pgConnection = null;

    // Build response based on report type
    let responseData = [];
    let grandTotals = {};

    if (reportType === "DIALER") {
      responseData = dialerData.map((row) => ({
        NAME: row.NAME,
        ANS_CALLS: Number(row.ANS_CALLS) || 0,
        MISSED_CALLS: Number(row.MISSED_CALLS) || 0,
        TOTAL_CALLS: Number(row.TOTAL_CALLS) || 0,
        TALK_TIME: row.TALK_TIME || "0:00:00",
        PROSPECT: Number(row.PROSPECT) || 0,
      }));

      let grandTotalCalls = 0;
      let grandMissedCalls = 0;
      let grandTotalCallsCount = 0;
      let grandTotalDuration = 0;
      let grandProspect = 0;

      responseData.forEach((row) => {
        grandTotalCalls += row.ANS_CALLS;
        grandMissedCalls += row.MISSED_CALLS;
        grandTotalCallsCount += row.TOTAL_CALLS;
        grandProspect += row.PROSPECT;

        if (row.TALK_TIME && typeof row.TALK_TIME === "string") {
          const timeParts = row.TALK_TIME.split(":");
          if (timeParts.length === 3) {
            grandTotalDuration +=
              Number.parseInt(timeParts[0]) * 3600 +
              Number.parseInt(timeParts[1]) * 60 +
              Number.parseInt(timeParts[2]);
          }
        }
      });

      const hours = Math.floor(grandTotalDuration / 3600);
      const minutes = Math.floor((grandTotalDuration % 3600) / 60);
      const seconds = grandTotalDuration % 60;
      const grandTotalTalkTime = `${hours}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(seconds).padStart(2, "0")}`;

      grandTotals = {
        ansCalls: grandTotalCalls,
        missedCalls: grandMissedCalls,
        totalCalls: grandTotalCallsCount,
        talkTime: grandTotalTalkTime,
        prospect: grandProspect,
      };
    } else if (reportType === "CRM") {
      responseData = crmData.map((row) => ({
        NAME: row.NAME,
        ANS_CALLS: row.CRM_CALLS,
        CRM_CALLS: row.CRM_CALLS,
        PROSPECT: row.CRM_PROSPECT,
        CRM_PROSPECT: row.CRM_PROSPECT,
        TOTAL_CALLS: row.CRM_CALLS,
      }));

      let grandCrmCalls = 0;
      let grandCrmProspect = 0;

      responseData.forEach((row) => {
        grandCrmCalls += row.CRM_CALLS;
        grandCrmProspect += row.CRM_PROSPECT;
      });

      grandTotals = {
        ansCalls: grandCrmCalls,
        crmCalls: grandCrmCalls,
        prospect: grandCrmProspect,
        crmProspect: grandCrmProspect,
        totalCalls: grandCrmCalls,
      };
    } else if (reportType === "MASTER") {
      // Merge dialer and CRM data by employee name
      const mergedMap = new Map();

      dialerData.forEach((row) => {
        const name = row.NAME;
        mergedMap.set(name, {
          NAME: name,
          ANS_CALLS: Number(row.ANS_CALLS) || 0,
          MISSED_CALLS: Number(row.MISSED_CALLS) || 0,
          TOTAL_CALLS: Number(row.TOTAL_CALLS) || 0,
          TALK_TIME: row.TALK_TIME || "0:00:00",
          PROSPECT: Number(row.PROSPECT) || 0,
          CRM_CALLS: 0,
          CRM_PROSPECT: 0,
        });
      });

      crmData.forEach((row) => {
        const name = row.NAME;
        if (mergedMap.has(name)) {
          const existing = mergedMap.get(name);
          existing.CRM_CALLS = row.CRM_CALLS;
          existing.CRM_PROSPECT = row.CRM_PROSPECT;
        } else {
          mergedMap.set(name, {
            NAME: name,
            ANS_CALLS: 0,
            MISSED_CALLS: 0,
            TOTAL_CALLS: 0,
            TALK_TIME: "0:00:00",
            PROSPECT: 0,
            CRM_CALLS: row.CRM_CALLS,
            CRM_PROSPECT: row.CRM_PROSPECT,
          });
        }
      });

      responseData = Array.from(mergedMap.values()).sort((a, b) => {
        const totalA = a.TOTAL_CALLS + a.CRM_CALLS;
        const totalB = b.TOTAL_CALLS + b.CRM_CALLS;
        return totalB - totalA;
      });

      let grandAnsCalls = 0;
      let grandMissedCalls = 0;
      let grandTotalCalls = 0;
      let grandProspect = 0;
      let grandCrmCalls = 0;
      let grandCrmProspect = 0;
      let grandTotalDuration = 0;

      responseData.forEach((row) => {
        grandAnsCalls += row.ANS_CALLS;
        grandMissedCalls += row.MISSED_CALLS;
        grandTotalCalls += row.TOTAL_CALLS;
        grandProspect += row.PROSPECT;
        grandCrmCalls += row.CRM_CALLS;
        grandCrmProspect += row.CRM_PROSPECT;

        // Calculate total talktime
        if (row.TALK_TIME && typeof row.TALK_TIME === "string") {
          const timeParts = row.TALK_TIME.split(":");
          if (timeParts.length === 3) {
            grandTotalDuration +=
              Number.parseInt(timeParts[0]) * 3600 +
              Number.parseInt(timeParts[1]) * 60 +
              Number.parseInt(timeParts[2]);
          }
        }
      });

      // Format grand total talktime
      const hours = Math.floor(grandTotalDuration / 3600);
      const minutes = Math.floor((grandTotalDuration % 3600) / 60);
      const seconds = grandTotalDuration % 60;
      const grandTotalTalkTime = `${hours}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(seconds).padStart(2, "0")}`;

      grandTotals = {
        ansCalls: grandAnsCalls,
        missedCalls: grandMissedCalls,
        totalCalls: grandTotalCalls,
        talkTime: grandTotalTalkTime, // Added talktime to grand totals
        prospect: grandProspect,
        crmCalls: grandCrmCalls,
        crmProspect: grandCrmProspect,
        grandProspect: grandProspect + grandCrmProspect,
        grandCalls: grandTotalCalls + grandCrmCalls,
      };
    }

    res.json({
      branch,
      reportType,
      data: responseData,
      grandTotals,
    });
  } catch (error) {
    console.error("Talktime Error:", error.message, error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
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
