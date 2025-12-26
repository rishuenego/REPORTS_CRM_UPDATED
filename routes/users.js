import express from "express"
import { supabase } from "../index.js"
import { authenticateToken, requireAdmin } from "../middleware/auth.js"

const router = express.Router()

// GET all users (Admin only)
router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, role, created_at")
      .order("created_at", { ascending: false })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ users })
  } catch (error) {
    console.error("[v0] Get users error:", error)
    res.status(500).json({ error: error.message })
  }
})

// GET single user by ID (Admin or self)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    // Users can only view their own data unless they're admin
    if (req.user.userId !== id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized" })
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, role, created_at")
      .eq("id", id)
      .maybeSingle()

    if (error || !user) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json({ user })
  } catch (error) {
    console.error("[v0] Get user error:", error)
    res.status(500).json({ error: error.message })
  }
})

// CREATE new user (Admin only)
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" })
    }

    if (username.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" })
    }

    if (password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters" })
    }

    if (!["user", "admin"].includes(role || "user")) {
      return res.status(400).json({ error: "Invalid role" })
    }

    // Check if username already exists
    const { data: existingUser } = await supabase.from("users").select("id").eq("username", username).maybeSingle()

    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" })
    }

    const { data: newUser, error } = await supabase
      .from("users")
      .insert([
        {
          username,
          password: password, // Plain text password
          role: role || "user",
          created_at: new Date(),
        },
      ])
      .select("id, username, role, created_at")
      .maybeSingle()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    console.log(`[v0] User created: ${newUser.username}`)
    res.status(201).json({ success: true, user: newUser })
  } catch (error) {
    console.error("[v0] Create user error:", error)
    res.status(500).json({ error: error.message })
  }
})

// UPDATE user (Admin only)
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { username, password, role } = req.body

    // Validation
    if (username && username.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" })
    }

    if (password && password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters" })
    }

    if (role && !["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" })
    }

    // Check if updating username to an existing one
    if (username) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .neq("id", id)
        .maybeSingle()

      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" })
      }
    }

    // Build update object
    const updateData = {}
    if (username) updateData.username = username
    if (role) updateData.role = role
    if (password) updateData.password = password

    // Update user
    const { data: updatedUser, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select("id, username, role, created_at")
      .maybeSingle()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" })
    }

    console.log(`[v0] User updated: ${updatedUser.username}`)
    res.json({ success: true, user: updatedUser })
  } catch (error) {
    console.error("[v0] Update user error:", error)
    res.status(500).json({ error: error.message })
  }
})

// DELETE user (Admin only)
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    // Prevent deleting self
    if (id === req.user.userId) {
      return res.status(400).json({ error: "Cannot delete your own account" })
    }

    // Get user details before deletion
    const { data: userToDelete } = await supabase.from("users").select("username").eq("id", id).maybeSingle()

    if (!userToDelete) {
      return res.status(404).json({ error: "User not found" })
    }

    // Delete user sessions first
    await supabase.from("user_sessions").delete().eq("user_id", id)

    // Delete user
    const { error } = await supabase.from("users").delete().eq("id", id)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    console.log(`[v0] User deleted: ${userToDelete.username}`)
    res.json({ success: true, message: "User deleted successfully" })
  } catch (error) {
    console.error("[v0] Delete user error:", error)
    res.status(500).json({ error: error.message })
  }
})

// SEARCH users (Admin only)
router.get("/search/:query", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { query } = req.params

    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, role, created_at")
      .ilike("username", `%${query}%`)
      .order("created_at", { ascending: false })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ users })
  } catch (error) {
    console.error("[v0] Search users error:", error)
    res.status(500).json({ error: error.message })
  }
})

export default router
