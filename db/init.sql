-- ============================================================
-- DevOps Infrastructure Dashboard — Database Initialization
-- ============================================================
-- Run this script on your MySQL server to set up the demo database.
-- Replace passwords as needed for your environment.
-- ============================================================

-- Create database
CREATE DATABASE IF NOT EXISTS devops_demo
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Create application user
CREATE USER IF NOT EXISTS 'admin'@'%' IDENTIFIED BY 'devops_password';
GRANT ALL PRIVILEGES ON devops_demo.* TO 'admin'@'%';
FLUSH PRIVILEGES;

-- Switch to the database
USE devops_demo;

-- Create demo table
CREATE TABLE IF NOT EXISTS demo_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed sample data
INSERT INTO demo_records (name, description) VALUES
    ('Web Server Alpha', 'Primary application server in the US-East region'),
    ('Database Replica', 'Read replica for analytics workloads'),
    ('Cache Layer', 'Memcached instance for session and query caching'),
    ('Load Balancer', 'Nginx reverse proxy with round-robin distribution'),
    ('Monitoring Agent', 'Prometheus metrics collector running on each node');
