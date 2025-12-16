import express from "express";
import { mysqlPool, pgPool } from "../index.js";

const router = express.Router();

const getBranchId = (branch) => {
  const branchMap = { AHM: 1, NOIDA: 2, CHENNAI: 3 };
  return branchMap[branch];
};

router.get("/report/:branch", async (req, res) => {
  let pgConnection = null;
  let mysqlConnection = null;

  try {
    const { branch } = req.params;
    const branchId = getBranchId(branch.toUpperCase());

    if (!branchId) {
      return res.status(400).json({ error: "Invalid branch" });
    }

    if (!pgPool) {
      return res.status(500).json({ error: "PostgreSQL pool not initialized" });
    }

    if (!mysqlPool) {
      return res.status(500).json({ error: "MySQL pool not initialized" });
    }

    pgConnection = await pgPool.connect();
    const { rows: employees } = await pgConnection.query(
      "SELECT name FROM public.hr_employee WHERE branch_id = $1 ORDER BY id ASC",
      [branchId]
    );
    pgConnection.release();
    pgConnection = null;

    const employeeNames = employees.map((e) => e.name);

    mysqlConnection = await mysqlPool.getConnection();
    const [rows] = await mysqlConnection.execute(`
      SELECT
          agent_name AS NAME,
          SUM(ans_calls) AS ANS_CALLS,
          SUM(missed_calls) AS MISSED_CALLS,
          SUM(total_calls) AS TOTAL_CALLS,
          SEC_TO_TIME(SUM(total_duration)) AS TALK_TIME
      FROM (
          SELECT
              agent_name,
              COUNT(*) AS ans_calls,
              0 AS missed_calls,
              COUNT(*) AS total_calls,
              SUM(duration) AS total_duration
          FROM call_logs.DialerAns
          WHERE DATE(createdAt) = CURDATE()
          GROUP BY agent_name

          UNION ALL

          SELECT
              agent_name,
              0 AS ans_calls,
              COUNT(*) AS missed_calls,
              COUNT(*) AS total_calls,
              SUM(duration) AS total_duration
          FROM call_logs.DialerMissed
          WHERE DATE(createdAt) = CURDATE()
          GROUP BY agent_name
      ) AS combined
      GROUP BY agent_name
      ORDER BY SUM(total_duration) DESC
    `);
    mysqlConnection.release();
    mysqlConnection = null;

    const filteredData = rows.filter((row) => {
      if (!row.NAME) return false;
      return employeeNames.some((name) => {
        if (!name) return false;
        return row.NAME.toLowerCase().includes(name.toLowerCase());
      });
    });

    let grandTotalCalls = 0;
    let grandMissedCalls = 0;
    let grandTotalCallsCount = 0;
    let grandTotalDuration = 0;

    filteredData.forEach((row) => {
      grandTotalCalls += Number(row.ANS_CALLS) || 0;
      grandMissedCalls += Number(row.MISSED_CALLS) || 0;
      grandTotalCallsCount += Number(row.TOTAL_CALLS) || 0;

      // Handle null or undefined TALK_TIME
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

    res.json({
      branch,
      data: filteredData,
      grandTotals: {
        ansCalls: grandTotalCalls,
        missedCalls: grandMissedCalls,
        totalCalls: grandTotalCallsCount,
        talkTime: grandTotalTalkTime,
      },
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
