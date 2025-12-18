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

    await supabase
      .from("user_sessions")
      .update({ status: "inactive", logout_time: new Date() })
      .eq("user_id", user.id)
      .eq("status", "active");

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

router.post("/validate-session", async (req, res) => {
  try {
    const { user_id } = req.body;

    const { data: session, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "active")
      .order("login_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !session) {
      return res.json({ valid: false });
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
      return res.json({ valid: false });
    }

    res.json({ valid: true });
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

    const userId = authorization.replace("Bearer ", "");
    const { data: adminUser, error: adminError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminUser) {
      return res.status(403).json({ error: "Only admin can create users" });
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
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

router.get("/users", async (req, res) => {
  try {
    const { authorization } = req.headers;

    if (!authorization) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = authorization.replace("Bearer ", "");
    const { data: adminUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminUser) {
      return res.status(403).json({ error: "Only admin can view users" });
    }

    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body;
    const { authorization } = req.headers;

    if (!authorization) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = authorization.replace("Bearer ", "");
    const { data: adminUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminUser) {
      return res.status(403).json({ error: "Only admin can update users" });
    }

    const updateData = { username, role };
    if (password) {
      updateData.password = password;
    }

    const { data: updatedUser, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { authorization } = req.headers;

    if (!authorization) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = authorization.replace("Bearer ", "");
    const { data: adminUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminUser) {
      return res.status(403).json({ error: "Only admin can delete users" });
    }

    if (id === userId) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }

    // Delete user sessions first
    await supabase.from("user_sessions").delete().eq("user_id", id);

    const { error } = await supabase.from("users").delete().eq("id", id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true });
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
