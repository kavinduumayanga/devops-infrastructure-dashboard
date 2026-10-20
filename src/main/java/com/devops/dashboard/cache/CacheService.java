package com.devops.dashboard.cache;

import com.devops.dashboard.config.AppConfig;
import com.devops.dashboard.config.MemcachedConfig;
import com.devops.dashboard.util.JsonUtil;
import net.spy.memcached.MemcachedClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Cache service wrapping Memcached operations with namespaced keys,
 * TTL management, and graceful fallback handling.
 */
public class CacheService {
    private static final Logger log = LoggerFactory.getLogger(CacheService.class);
    private static final String KEY_PREFIX = "devops_dash:";

    public enum LookupStatus {
        HIT,
        MISS,
        UNAVAILABLE
    }

    public record LookupResult(LookupStatus status, String value) {}

    private final int ttlSeconds;
    private final long operationTimeoutMs;

    public CacheService() {
        AppConfig config = AppConfig.getInstance();
        this.ttlSeconds = config.getCacheTtlSeconds();
        this.operationTimeoutMs = config.getCacheOperationTimeoutMs();
    }

    public CacheService(int ttlSeconds, long operationTimeoutMs) {
        this.ttlSeconds = ttlSeconds;
        this.operationTimeoutMs = operationTimeoutMs;
    }

    /**
     * Get a value from cache.
     * @return the cached value, or null if not found or unavailable
     */
    public String get(String key) {
        LookupResult result = lookup(key);
        return result.status() == LookupStatus.HIT ? result.value() : null;
    }

    /**
     * Read a cache key while preserving the distinction between a miss and an
     * unavailable cache server.
     */
    public LookupResult lookup(String key) {
        try {
            MemcachedClient client = MemcachedConfig.getClient();
            if (client == null) {
                return new LookupResult(LookupStatus.UNAVAILABLE, null);
            }

            String namespacedKey = KEY_PREFIX + key;
            Future<Object> future = client.asyncGet(namespacedKey);
            Object result = future.get(operationTimeoutMs, TimeUnit.MILLISECONDS);
            if (result != null) {
                log.debug("Cache HIT for key: {}", namespacedKey);
                return new LookupResult(LookupStatus.HIT, result.toString());
            }
            log.debug("Cache MISS for key: {}", namespacedKey);
            return new LookupResult(LookupStatus.MISS, null);
        } catch (Exception e) {
            log.warn("Cache get failed for key {}: {}", key, e.getMessage());
            return new LookupResult(LookupStatus.UNAVAILABLE, null);
        }
    }

    /**
     * Store a value in cache with configured TTL.
     */
    public boolean set(String key, String value) {
        return set(key, value, ttlSeconds);
    }

    /**
     * Store a value in cache with specified TTL.
     */
    public boolean set(String key, String value, int ttl) {
        try {
            MemcachedClient client = MemcachedConfig.getClient();
            if (client == null) return false;

            String namespacedKey = KEY_PREFIX + key;
            Future<Boolean> future = client.set(namespacedKey, ttl, value);
            boolean result = future.get(operationTimeoutMs, TimeUnit.MILLISECONDS);
            log.debug("Cache SET for key: {} (ttl={}s, result={})", namespacedKey, ttl, result);
            return result;
        } catch (Exception e) {
            log.warn("Cache set failed for key {}: {}", key, e.getMessage());
            return false;
        }
    }

    /**
     * Delete a value from cache.
     */
    public boolean delete(String key) {
        try {
            MemcachedClient client = MemcachedConfig.getClient();
            if (client == null) return false;

            String namespacedKey = KEY_PREFIX + key;
            Future<Boolean> future = client.delete(namespacedKey);
            boolean existed = future.get(operationTimeoutMs, TimeUnit.MILLISECONDS);
            log.debug("Cache DELETE completed for key: {} (existed={})", namespacedKey, existed);
            return true;
        } catch (Exception e) {
            log.warn("Cache delete failed for key {}: {}", key, e.getMessage());
            return false;
        }
    }

    /**
     * Check if Memcached is available and responsive.
     */
    public Map<String, Object> healthCheck() {
        long start = System.nanoTime();
        try {
            MemcachedClient client = MemcachedConfig.getClient();
            if (client == null) {
                return Map.of(
                    "status", "DOWN",
                    "error", "Memcached client is not initialized"
                );
            }

            boolean available = !client.getAvailableServers().isEmpty();
            long latencyMs = (System.nanoTime() - start) / 1_000_000;

            if (available) {
                // Quick read/write test
                String testKey = KEY_PREFIX + "__health__";
                String testVal = String.valueOf(System.currentTimeMillis());
                client.set(testKey, 10, testVal).get(operationTimeoutMs, TimeUnit.MILLISECONDS);
                Object readBack = client.asyncGet(testKey).get(operationTimeoutMs, TimeUnit.MILLISECONDS);
                latencyMs = (System.nanoTime() - start) / 1_000_000;

                boolean readWritePassed = readBack != null && readBack.toString().equals(testVal);
                return Map.of(
                    "status", readWritePassed ? "UP" : "DOWN",
                    "latencyMs", latencyMs,
                    "readWriteTest", readWritePassed ? "PASS" : "FAIL",
                    "availableServers", client.getAvailableServers().size(),
                    "ttlSeconds", ttlSeconds
                );
            } else {
                return Map.of(
                    "status", "DOWN",
                    "error", "No available Memcached servers",
                    "latencyMs", latencyMs
                );
            }
        } catch (Exception e) {
            long latencyMs = (System.nanoTime() - start) / 1_000_000;
            return Map.of(
                "status", "DOWN",
                "error", e.getMessage() != null ? e.getMessage() : "Unknown error",
                "latencyMs", latencyMs
            );
        }
    }

    /**
     * Get cache statistics from the Memcached server.
     */
    public Map<String, Object> getStats() {
        try {
            MemcachedClient client = MemcachedConfig.getClient();
            if (client == null) {
                return Map.of("status", "UNAVAILABLE");
            }

            var statsMap = client.getStats();
            if (statsMap.isEmpty()) {
                return Map.of("status", "NO_STATS");
            }

            // Aggregate stats from all servers
            var firstEntry = statsMap.entrySet().iterator().next();
            var stats = firstEntry.getValue();

            return Map.of(
                "status", "AVAILABLE",
                "currentItems", stats.getOrDefault("curr_items", "0"),
                "totalItems", stats.getOrDefault("total_items", "0"),
                "getHits", stats.getOrDefault("get_hits", "0"),
                "getMisses", stats.getOrDefault("get_misses", "0"),
                "bytesUsed", stats.getOrDefault("bytes", "0"),
                "maxBytes", stats.getOrDefault("limit_maxbytes", "0"),
                "uptime", stats.getOrDefault("uptime", "0"),
                "version", stats.getOrDefault("version", "unknown")
            );
        } catch (Exception e) {
            log.warn("Failed to retrieve Memcached stats: {}", e.getMessage());
            return Map.of("status", "ERROR", "error", e.getMessage() != null ? e.getMessage() : "Unknown error");
        }
    }

    public int getTtlSeconds() {
        return ttlSeconds;
    }
}
