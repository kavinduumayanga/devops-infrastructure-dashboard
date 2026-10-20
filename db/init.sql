-- ============================================================
-- DevOps Infrastructure Dashboard — Database Initialization
-- ============================================================
-- Run this script on your MySQL server to set up the demo database.
-- Database users and privileges are managed separately by an administrator.
-- ============================================================

-- Create database
CREATE DATABASE IF NOT EXISTS devops_demo
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Switch to the database
USE devops_demo;

-- Create demo table
CREATE TABLE IF NOT EXISTS demo_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed sample data only when the table is empty. Existing records are preserved.
INSERT INTO demo_records (name, description)
SELECT seed.name, seed.description
FROM (
    SELECT 'Web Server Alpha' AS name,
           'Primary application server in the US-East region' AS description
    UNION ALL
    SELECT 'Database Replica', 'Read replica for analytics workloads'
    UNION ALL
    SELECT 'Cache Layer', 'Memcached instance for session and query caching'
    UNION ALL
    SELECT 'Load Balancer', 'Nginx reverse proxy with round-robin distribution'
    UNION ALL
    SELECT 'Monitoring Agent', 'Prometheus metrics collector running on each node'
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM demo_records LIMIT 1);
