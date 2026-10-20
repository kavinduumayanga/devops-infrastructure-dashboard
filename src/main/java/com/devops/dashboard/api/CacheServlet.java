package com.devops.dashboard.api;

import com.devops.dashboard.cache.CacheService;
import com.devops.dashboard.dto.ApiResponse;
import com.devops.dashboard.dto.CacheDemoResponse;
import com.devops.dashboard.service.CacheDemoService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

/**
 * Cache API endpoints.
 * GET    /api/cache/health  - Cache health check
 * GET    /api/cache/demo    - Fetch data using cache-aside pattern
 * DELETE /api/cache/demo    - Clear demo cache
 * GET    /api/cache/stats   - Cache server statistics
 */
@WebServlet(urlPatterns = "/api/cache/*")
public class CacheServlet extends BaseServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String pathInfo = req.getPathInfo();
        if (pathInfo == null) {
            writeError(resp, 404, "Endpoint not found");
            return;
        }

        switch (pathInfo) {
            case "/health" -> handleHealthCheck(resp);
            case "/demo" -> handleCacheDemo(resp);
            case "/stats" -> handleStats(resp);
            default -> writeError(resp, 404, "Unknown cache endpoint: " + pathInfo);
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String pathInfo = req.getPathInfo();
        if ("/demo".equals(pathInfo)) {
            handleClearCache(resp);
        } else {
            writeError(resp, 404, "Endpoint not found");
        }
    }

    private void handleHealthCheck(HttpServletResponse resp) throws IOException {
        try {
            CacheService cacheService = getService("cacheService");
            Map<String, Object> health = cacheService.healthCheck();
            writeApiResponse(resp, 200, ApiResponse.success(health));
        } catch (Exception e) {
            log.error("Cache health check failed: {}", e.getMessage());
            writeApiResponse(resp, 200, ApiResponse.success(
                    Map.of("status", "DOWN", "error", "Health check failed")));
        }
    }

    private void handleCacheDemo(HttpServletResponse resp) throws IOException {
        try {
            CacheDemoService cacheDemoService = getService("cacheDemoService");
            CacheDemoResponse result = cacheDemoService.fetchWithCacheAside();
            writeApiResponse(resp, 200, ApiResponse.success(result)
                    .withDuration(result.getDurationMs()));
        } catch (Exception e) {
            log.error("Cache demo failed", e);
            writeError(resp, 503, "Database is unavailable; cache demo data could not be loaded");
        }
    }

    private void handleClearCache(HttpServletResponse resp) throws IOException {
        try {
            CacheDemoService cacheDemoService = getService("cacheDemoService");
            boolean cleared = cacheDemoService.clearDemoCache();
            if (!cleared) {
                writeError(resp, 503, "Memcached is unavailable; demo cache could not be cleared");
                return;
            }
            writeApiResponse(resp, 200, ApiResponse.success(
                    Map.of("cleared", true), "Demo cache cleared"));
        } catch (Exception e) {
            log.error("Cache clear failed: {}", e.getMessage());
            writeError(resp, 500, "Failed to clear cache");
        }
    }

    private void handleStats(HttpServletResponse resp) throws IOException {
        try {
            CacheService cacheService = getService("cacheService");
            Map<String, Object> stats = cacheService.getStats();
            writeApiResponse(resp, 200, ApiResponse.success(stats));
        } catch (Exception e) {
            log.error("Cache stats failed: {}", e.getMessage());
            writeError(resp, 503, "Failed to retrieve cache statistics");
        }
    }
}
