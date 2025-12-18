import express from "express";
import { supabase } from "../index.js";

const router = express.Router();

router.get("/user-activity", async (req, res) => {
  try {
    const { data: sessions, error } = await supabase
      .from("user_sessions")
      .select(
        `
        *,
        users:user_id (
          id,
          username
        )
      `
      )
      .order("login_time", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const formattedSessions = (sessions || []).map((session) => ({
      id: session.id,
      username: session.users?.username || "Unknown",
      loginTime: session.login_time,
      logoutTime: session.logout_time,
      status: session.status,
    }));

    const activeCount = formattedSessions.filter(
      (s) => s.status === "active"
    ).length;
    const totalCount = formattedSessions.length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySessions = formattedSessions.filter((s) => {
      const loginDate = new Date(s.loginTime);
      return loginDate >= today;
    }).length;

    let totalDuration = 0;
    let completedSessions = 0;
    formattedSessions.forEach((s) => {
      if (s.logoutTime) {
        const loginTime = new Date(s.loginTime);
        const logoutTime = new Date(s.logoutTime);
        const duration = (logoutTime - loginTime) / (1000 * 60); // in minutes
        totalDuration += duration;
        completedSessions++;
      }
    });

    const avgDuration =
      completedSessions > 0 ? Math.round(totalDuration / completedSessions) : 0;
    const avgSessionDuration =
      avgDuration < 60
        ? `${avgDuration}m`
        : `${Math.floor(avgDuration / 60)}h ${avgDuration % 60}m`;

    res.json({
      sessions: formattedSessions,
      stats: {
        activeUsers: activeCount,
        totalSessions: totalCount,
        todaySessions,
        avgSessionDuration,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
