package com.devops.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * DTO for cache demo response with source and timing.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CacheDemoResponse {
    private String source;       // "MYSQL" or "MEMCACHED"
    private String cacheStatus;  // "HIT", "MISS", "UNAVAILABLE", or "ERROR"
    private String cacheWriteStatus;
    private long durationMs;
    private List<?> data;
    private int cacheTtlSeconds;
    private String cacheKey;

    public CacheDemoResponse() {}

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getCacheStatus() { return cacheStatus; }
    public void setCacheStatus(String cacheStatus) { this.cacheStatus = cacheStatus; }

    public String getCacheWriteStatus() { return cacheWriteStatus; }
    public void setCacheWriteStatus(String cacheWriteStatus) { this.cacheWriteStatus = cacheWriteStatus; }

    public long getDurationMs() { return durationMs; }
    public void setDurationMs(long durationMs) { this.durationMs = durationMs; }

    public List<?> getData() { return data; }
    public void setData(List<?> data) { this.data = data; }

    public int getCacheTtlSeconds() { return cacheTtlSeconds; }
    public void setCacheTtlSeconds(int cacheTtlSeconds) { this.cacheTtlSeconds = cacheTtlSeconds; }

    public String getCacheKey() { return cacheKey; }
    public void setCacheKey(String cacheKey) { this.cacheKey = cacheKey; }
}
