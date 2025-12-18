import express from "express";
import { mysqlPool, pgPool } from "../index.js";

const router = express.Router();

const getBranchId = (branch) => {
  const branchMap = { AHM: 1, NOIDA: 2, CHENNAI: 3 };
  return branchMap[branch];
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

router.get("/report", async (req, res) => {
  let mysqlConnection = null;

  try {
    const { agentName, branch, startDate, endDate } = req.query;

    if (!agentName || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    mysqlConnection = await mysqlPool.getConnection();

    // Query for each day in the date range with prospect calculation
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

export default router;
