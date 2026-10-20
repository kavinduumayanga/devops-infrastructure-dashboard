package com.devops.dashboard.service;

import com.devops.dashboard.cache.CacheService;
import com.devops.dashboard.cache.CacheService.LookupResult;
import com.devops.dashboard.cache.CacheService.LookupStatus;
import com.devops.dashboard.dto.CacheDemoResponse;
import com.devops.dashboard.model.DemoRecord;
import com.devops.dashboard.repository.RecordRepository;
import com.devops.dashboard.util.JsonUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

/**
 * Service implementing cache-aside pattern with Memcached and MySQL.
 */
public class CacheDemoService {
    private static final Logger log = LoggerFactory.getLogger(CacheDemoService.class);
    private static final String DEMO_CACHE_KEY = "demo_records";

    private final RecordRepository repository;
    private final CacheService cacheService;

    public CacheDemoService(RecordRepository repository, CacheService cacheService) {
        this.repository = repository;
        this.cacheService = cacheService;
    }

    /**
     * Fetch data using cache-aside pattern.
     * 1. Try Memcached first
     * 2. On a miss, query MySQL and cache the result
     * 3. If Memcached is unavailable, serve from MySQL without claiming a miss
     */
    public CacheDemoResponse fetchWithCacheAside() {
        CacheDemoResponse response = new CacheDemoResponse();
        response.setCacheTtlSeconds(cacheService.getTtlSeconds());
        response.setCacheKey(DEMO_CACHE_KEY);

        long start = System.nanoTime();
        LookupResult lookup;

        try {
            lookup = cacheService.lookup(DEMO_CACHE_KEY);
        } catch (RuntimeException e) {
            log.warn("Cache lookup failed; using MySQL: {}", e.getMessage());
            lookup = new LookupResult(LookupStatus.UNAVAILABLE, null);
        }

        if (lookup.status() == LookupStatus.HIT) {
            try {
                List<DemoRecord> records = JsonUtil.getMapper().readValue(
                        lookup.value(), new TypeReference<List<DemoRecord>>() {});
                long durationMs = (System.nanoTime() - start) / 1_000_000;

                response.setSource("MEMCACHED");
                response.setCacheStatus("HIT");
                response.setCacheWriteStatus("NOT_APPLICABLE");
                response.setDurationMs(durationMs);
                response.setData(records);

                log.debug("Cache HIT for demo_records ({} records, {}ms)", records.size(), durationMs);
                return response;
            } catch (Exception e) {
                log.warn("Cached demo records are invalid; reloading from MySQL: {}", e.getMessage());
                response.setCacheStatus("ERROR");
                cacheService.delete(DEMO_CACHE_KEY);
            }
        } else if (lookup.status() == LookupStatus.UNAVAILABLE) {
            response.setCacheStatus("UNAVAILABLE");
        } else {
            response.setCacheStatus("MISS");
        }

        try {
            List<DemoRecord> records = repository.findAll();
            response.setSource("MYSQL");
            response.setData(records);

            if (lookup.status() == LookupStatus.MISS) {
                try {
                    boolean stored = cacheService.set(DEMO_CACHE_KEY, JsonUtil.toJson(records));
                    response.setCacheWriteStatus(stored ? "STORED" : "FAILED");
                } catch (RuntimeException e) {
                    log.warn("Cache write failed after a real miss: {}", e.getMessage());
                    response.setCacheWriteStatus("FAILED");
                }
            } else {
                response.setCacheWriteStatus("SKIPPED");
            }
        } catch (Exception e) {
            log.error("Cache demo could not load records from MySQL", e);
            throw new IllegalStateException("Unable to load demo records from the database", e);
        }

        response.setDurationMs((System.nanoTime() - start) / 1_000_000);
        log.debug("Cache demo served from MySQL (cacheStatus={}, records={}, duration={}ms)",
                response.getCacheStatus(), response.getData().size(), response.getDurationMs());
        return response;
    }

    /**
     * Invalidate the demo cache. Called when records change.
     */
    public boolean invalidateCache() {
        log.info("Invalidating demo cache");
        return cacheService.delete(DEMO_CACHE_KEY);
    }

    /**
     * Clear the demo cache entry explicitly (user action).
     */
    public boolean clearDemoCache() {
        log.info("Clearing demo cache (user action)");
        return cacheService.delete(DEMO_CACHE_KEY);
    }
}
