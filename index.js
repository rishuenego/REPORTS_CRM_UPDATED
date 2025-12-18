import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import mysql from "mysql2/promise";
import pg from "pg";
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import talktimeRoutes from "./routes/talktime.js";
import downloadRoutes from "./routes/downloads.js";
import messagingRoutes from "./routes/messaging.js";
import pipelineRoutes from "./routes/pipeline.js";
import agentRoutes from "./routes/agent.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

export const mysqlPool = mysql.createPool({
  user: "admin",
  password: "jitendraSengar70",
  host: "database-1.czoay60ycth7.ap-south-1.rds.amazonaws.com",
  database: "call_logs",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const pgPool = new pg.Pool({
  host: "94.136.187.76",
  user: "odoo",
  password: "enego@73030",
  database: "enego_production",
  port: 5432,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/talktime", talktimeRoutes);
app.use("/api/downloads", downloadRoutes);
app.use("/api/messaging", messagingRoutes);
app.use("/api/pipeline", pipelineRoutes);
app.use("/api/agent", agentRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "API is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
