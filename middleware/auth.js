import jwt from "jsonwebtoken";
import { supabase } from "../index.js";

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify session is still active
    const { data: session, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", decoded.userId)
      .eq("status", "active")
      .order("login_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !session) {
      return res.status(401).json({ error: "Session expired or invalid" });
    }

    // Check if session is older than 24 hours
    const loginTime = new Date(session.login_time);
    const now = new Date();
    const hoursDiff = (now - loginTime) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      await supabase
        .from("user_sessions")
        .update({ status: "inactive", logout_time: new Date() })
        .eq("id", session.id);
      return res.status(401).json({ error: "Session expired" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("role")
      .eq("id", req.user.userId)
      .maybeSingle();

    if (error || !user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
