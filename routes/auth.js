import express from "express";
import jwt from "jsonwebtoken";
import { supabase } from "../index.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (password !== user.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || "fallback-secret-key",
      { expiresIn: "24h" }
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
    res.status(500).json({ error: error.message });
  }
});

// Get all users (Admin only)
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

// Create user (Admin only)
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
          { username, password, role: role || "user", created_at: new Date() },
        ])
        .select("id, username, role, created_at")
        .maybeSingle();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({ success: true, user: newUser });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Update user (Admin only)
router.put("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body;

    const updateData = {};
    if (username) updateData.username = username;
    if (role) updateData.role = role;
    if (password) updateData.password = password;

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

// Delete user (Admin only)
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

// Logout
router.post("/logout", authenticateToken, async (req, res) => {
  res.json({ success: true });
});

// Validate session
router.post("/validate-session", authenticateToken, async (req, res) => {
  res.json({ valid: true, user: req.user });
});

export default router;
