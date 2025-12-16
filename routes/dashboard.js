import express from 'express';
import { supabase } from '../index.js';

const router = express.Router();

router.get('/user-activity', async (req, res) => {
  try {
    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select(`
        *,
        users:user_id (
          id,
          username
        )
      `)
      .order('login_time', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const formattedSessions = sessions.map(session => ({
      id: session.id,
      username: session.users?.username,
      loginTime: session.login_time,
      logoutTime: session.logout_time,
      status: session.status
    }));

    const activeCount = formattedSessions.filter(s => s.status === 'active').length;
    const totalCount = formattedSessions.length;

    res.json({
      sessions: formattedSessions,
      stats: {
        activeUsers: activeCount,
        totalSessions: totalCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
