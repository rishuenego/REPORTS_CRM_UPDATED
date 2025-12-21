import express from "express";
import { supabase } from "../index.js";

const router = express.Router();

router.get("/user-activity", async (req, res) => {
  try {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, username");

    if (usersError) {
      return res.status(400).json({ error: usersError.message });
    }

    // Fetch all sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from("user_sessions")
      .select("*")
      .order("login_time", { ascending: false });

    if (sessionsError) {
      return res.status(400).json({ error: sessionsError.message });
    }

    // Create a map of users by id
    const usersMap = new Map();
    (users || []).forEach((user) => {
      usersMap.set(user.id, user.username);
    });

    // Format sessions with user data
    const formattedSessions = (sessions || []).map((session) => ({
      id: session.id,
      username: usersMap.get(session.user_id) || "Unknown",
      userId: session.user_id,
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

    const uniqueUsers = new Set(formattedSessions.map((s) => s.userId)).size;

    res.json({
      sessions: formattedSessions,
      stats: {
        activeUsers: activeCount,
        totalSessions: totalCount,
        todaySessions,
        avgSessionDuration,
        uniqueUsers,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
