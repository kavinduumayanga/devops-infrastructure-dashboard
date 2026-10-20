package com.devops.dashboard.repository;

import com.devops.dashboard.config.DatabaseConfig;
import com.devops.dashboard.model.DemoRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Repository for demo_records MySQL table.
 */
public class RecordRepository {
    private static final Logger log = LoggerFactory.getLogger(RecordRepository.class);
    private static final int MAX_RECORDS = 100;

    private final DataSource dataSource;

    public RecordRepository() {
        this.dataSource = DatabaseConfig.getDataSource();
    }

    public RecordRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /**
     * Initializes the demo_records table if it doesn't exist.
     */
    public void initializeTable() {
        String sql = """
            CREATE TABLE IF NOT EXISTS demo_records (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                description VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """;
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute(sql);
            log.info("demo_records table initialized");
        } catch (SQLException e) {
            log.error("Failed to initialize demo_records table: {}", e.getMessage());
        }
    }

    /**
     * Test database connectivity with SELECT 1 and return latency in ms.
     */
    public long pingDatabase() throws SQLException {
        long start = System.nanoTime();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT 1")) {
            ps.executeQuery();
        }
        return (System.nanoTime() - start) / 1_000_000;
    }

    /**
     * Get database metadata.
     */
    public String getDatabaseVersion() throws SQLException {
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            return meta.getDatabaseProductName() + " " + meta.getDatabaseProductVersion();
        }
    }

    /**
     * Fetch all records, bounded to MAX_RECORDS.
     */
    public List<DemoRecord> findAll() throws SQLException {
        String sql = "SELECT id, name, description, created_at FROM demo_records ORDER BY created_at DESC LIMIT ?";
        List<DemoRecord> records = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, MAX_RECORDS);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    records.add(mapRow(rs));
                }
            }
        }
        return records;
    }

    /**
     * Find a record by ID.
     */
    public DemoRecord findById(long id) throws SQLException {
        String sql = "SELECT id, name, description, created_at FROM demo_records WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return mapRow(rs);
                }
            }
        }
        return null;
    }

    /**
     * Insert a new record and return it with the generated ID.
     */
    public DemoRecord create(String name, String description) throws SQLException {
        String sql = "INSERT INTO demo_records (name, description) VALUES (?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.setString(2, description);
            ps.executeUpdate();

            try (ResultSet keys = ps.getGeneratedKeys()) {
                if (keys.next()) {
                    long id = keys.getLong(1);
                    return findById(id);
                }
            }
        }
        throw new SQLException("Failed to retrieve generated ID after insert");
    }

    /**
     * Delete a record by ID. Returns true if deleted.
     */
    public boolean delete(long id) throws SQLException {
        String sql = "DELETE FROM demo_records WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, id);
            return ps.executeUpdate() > 0;
        }
    }

    /**
     * Count total records.
     */
    public long count() throws SQLException {
        String sql = "SELECT COUNT(*) FROM demo_records";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql);
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) {
                return rs.getLong(1);
            }
        }
        return 0;
    }

    private DemoRecord mapRow(ResultSet rs) throws SQLException {
        DemoRecord record = new DemoRecord();
        record.setId(rs.getLong("id"));
        record.setName(rs.getString("name"));
        record.setDescription(rs.getString("description"));
        Timestamp ts = rs.getTimestamp("created_at");
        if (ts != null) {
            record.setCreatedAt(ts.toInstant());
        }
        return record;
    }
}
