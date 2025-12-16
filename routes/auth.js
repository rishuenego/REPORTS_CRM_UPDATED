import express from "express";
import { supabase } from "../index.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await supabase.from("user_sessions").insert([
      {
        user_id: user.id,
        login_time: new Date(),
        status: "active",
      },
    ]);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/create-user", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const { authorization } = req.headers;

    if (!authorization) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const adminUser = await supabase
      .from("users")
      .select("*")
      .eq("role", "admin")
      .maybeSingle();

    if (!adminUser.data) {
      return res.status(403).json({ error: "Only admin can create users" });
    }

    const { data: newUser, error } = await supabase
      .from("users")
      .insert([
        {
          username,
          password,
          role: role || "user",
          created_at: new Date(),
        },
      ])
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      success: true,
      user: newUser,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { user_id } = req.body;

    await supabase
      .from("user_sessions")
      .update({ status: "inactive", logout_time: new Date() })
      .eq("user_id", user_id)
      .eq("status", "active");

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
