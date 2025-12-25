-- Create Users_details table for message broadcasting
-- Run this script in your MySQL database (agents_data schema)

CREATE DATABASE IF NOT EXISTS agents_data;

USE agents_data;

CREATE TABLE IF NOT EXISTS Users_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  branch VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_phone (phone),
  INDEX idx_branch (branch),
  INDEX idx_name (name)
);

-- Sample data (optional)
-- INSERT INTO Users_details (name, phone, branch) VALUES
-- ('John Doe', '9876543210', 'NOIDA'),
-- ('Jane Smith', '9876543211', 'AHM'),
-- ('Bob Wilson', '9876543212', 'CHENNAI');
