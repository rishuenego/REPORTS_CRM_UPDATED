-- SQL script to create the Users_details table if it doesn't exist
-- Run this script once to set up the messaging users table

CREATE DATABASE IF NOT EXISTS agents_data;

USE agents_data;

CREATE TABLE IF NOT EXISTS Users_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  branch VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_branch (branch),
  INDEX idx_phone (phone),
  INDEX idx_name (name)
);

-- Insert sample data (optional - remove if not needed)
-- INSERT INTO Users_details (name, phone, branch) VALUES
-- ('Sample User 1', '9876543210', 'AHM'),
-- ('Sample User 2', '9876543211', 'NOIDA'),
-- ('Sample User 3', '9876543212', 'CHENNAI');
