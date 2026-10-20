package com.devops.dashboard.api;

import com.devops.dashboard.config.AppConfig;
import com.devops.dashboard.config.DatabaseConfig;
import com.devops.dashboard.dto.ApiResponse;
import com.devops.dashboard.repository.RecordRepository;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GET /api/database/health - Database connectivity and health check.
 */
@WebServlet(urlPatterns = "/api/database/health")
public class DatabaseHealthServlet extends BaseServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        Map<String, Object> health = new LinkedHashMap<>();
        long start = System.nanoTime();

        try {
            RecordRepository repository = getService("recordRepository");
            long pingMs = repository.pingDatabase();
            String version = repository.getDatabaseVersion();
            long totalDurationMs = (System.nanoTime() - start) / 1_000_000;

            AppConfig config = AppConfig.getInstance();
            health.put("status", "UP");
            health.put("pingLatencyMs", pingMs);
            health.put("version", version);
            health.put("database", config.getDbName());
            health.put("host", config.getDbHost());
            health.put("port", config.getDbPort());
            health.put("totalDurationMs", totalDurationMs);
            health.put("recordCount", repository.count());
            health.put("connectionPool", DatabaseConfig.getPoolStats());

            writeApiResponse(resp, 200, ApiResponse.success(health));
        } catch (Exception e) {
            long totalDurationMs = (System.nanoTime() - start) / 1_000_000;
            log.error("Database health check failed: {}", e.getMessage());

            AppConfig config = AppConfig.getInstance();
            health.put("status", "DOWN");
            health.put("error", "Database connection failed");
            health.put("database", config.getDbName());
            health.put("host", config.getDbHost());
            health.put("port", config.getDbPort());
            health.put("totalDurationMs", totalDurationMs);

            writeApiResponse(resp, 200, ApiResponse.success(health, "Database is unavailable"));
        }
    }
}
