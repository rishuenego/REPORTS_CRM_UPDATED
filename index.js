import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import dotenv from "dotenv"
import rateLimit from "express-rate-limit"
import { createClient } from "@supabase/supabase-js"
import mysql from "mysql2/promise"
import pg from "pg"
import authRoutes from "./routes/auth.js"
import dashboardRoutes from "./routes/dashboard.js"
import talktimeRoutes from "./routes/talktime.js"
import downloadRoutes from "./routes/downloads.js"
import messagingRoutes from "./routes/messaging.js"
import pipelineRoutes from "./routes/pipeline.js"
import agentRoutes from "./routes/agent.js"
import dispoRoutes from "./routes/dispo.js"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per windowMs
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Apply general rate limiting to all routes
app.use(generalLimiter)

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)

export const mysqlPool = mysql.createPool({
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  host: process.env.MYSQL_HOST,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export const pgPool = new pg.Pool({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  port: Number.parseInt(process.env.PG_PORT) || 5432,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Apply stricter rate limiting to auth routes
app.use("/api/auth", authLimiter, authRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/talktime", talktimeRoutes)
app.use("/api/downloads", downloadRoutes)
app.use("/api/messaging", messagingRoutes)
app.use("/api/pipeline", pipelineRoutes)
app.use("/api/agent", agentRoutes)
app.use("/api/dispo", dispoRoutes)

app.get("/api/health", (req, res) => {
  res.json({ status: "API is running" })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
