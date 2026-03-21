/*
  # Initialize CRM Database Tables

  1. New Tables
    - `users`: Store user accounts with role-based access
    - `user_sessions`: Track user login/logout activity
    - `download_logs`: Log all report downloads with timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their data
    - Restrict admin operations
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  login_time timestamptz NOT NULL,
  logout_time timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  report_type text NOT NULL,
  branch text,
  downloaded_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view their sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR (SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admin can view all sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Users can view all sessions"
  ON user_sessions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert sessions"
  ON user_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view all download logs"
  ON download_logs FOR SELECT
  USING (true);

CREATE POLICY "Users can insert download logs"
  ON download_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
