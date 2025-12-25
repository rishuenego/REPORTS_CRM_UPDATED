import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../index.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Get user by username
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    let isValidPassword = false;

    // Check if password is already hashed (bcrypt hashes start with $2)
    if (user.password.startsWith("$2")) {
      // Password is hashed, use bcrypt compare
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      // Password is plain text (legacy), do direct comparison
      isValidPassword = password === user.password;

      // If valid, migrate to bcrypt hash automatically
      if (isValidPassword) {
        // Skip password migration for RISHU
        if (username !== "RISHU") {
          const hashedPassword = await bcrypt.hash(password, 12);
          await supabase
            .from("users")
            .update({ password: hashedPassword })
            .eq("id", user.id);
          console.log(`[v0] Auto-migrated password for user: ${username}`);
        } else {
          console.log(`[v0] Skipped password migration for user: ${username}`);
        }
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Invalidate previous sessions
    await supabase
      .from("user_sessions")
      .update({ status: "inactive", logout_time: new Date() })
      .eq("user_id", user.id)
      .eq("status", "active");

    // Create new session
    await supabase.from("user_sessions").insert([
      {
        user_id: user.id,
        login_time: new Date(),
        status: "active",
      },
    ]);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || "fallback-secret-key-change-in-production",
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[v0] Login error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/validate-session", authenticateToken, async (req, res) => {
  try {
    res.json({ valid: true, user: req.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  "/create-user",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { username, password, role } = req.body;

      if (!username || !password) {
        return res
          .status(400)
          .json({ error: "Username and password are required" });
      }

      // Check if username exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash password with bcrypt (salt rounds = 12)
      const hashedPassword = await bcrypt.hash(password, 12);

      const { data: newUser, error } = await supabase
        .from("users")
        .insert([
          {
            username,
            password: hashedPassword,
            role: role || "user",
            created_at: new Date(),
          },
        ])
        .select("id, username, role, created_at")
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
  }
);

router.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
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

router.put("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body;

    const updateData = { username, role };

    // Hash new password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    const { data: updatedUser, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select("id, username, role, created_at")
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete(
  "/users/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (id === req.user.userId) {
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
  }
);

router.post("/logout", authenticateToken, async (req, res) => {
  try {
    await supabase
      .from("user_sessions")
      .update({ status: "inactive", logout_time: new Date() })
      .eq("user_id", req.user.userId)
      .eq("status", "active");

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  "/migrate-passwords",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { data: users, error } = await supabase
        .from("users")
        .select("id, password");

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      let migratedCount = 0;
      for (const user of users) {
        // Check if password is already hashed (bcrypt hashes start with $2)
        if (!user.password.startsWith("$2")) {
          const hashedPassword = await bcrypt.hash(user.password, 12);
          await supabase
            .from("users")
            .update({ password: hashedPassword })
            .eq("id", user.id);
          migratedCount++;
        }
      }

      res.json({ success: true, migratedCount });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
