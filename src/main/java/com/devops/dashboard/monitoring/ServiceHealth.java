package com.devops.dashboard.monitoring;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public record ServiceHealth(
        String id,
        String name,
        HealthStatus status,
        String monitoringType,
        Long latencyMs,
        Instant lastCheckedAt,
        Instant lastSuccessfulAt,
        String error,
        Map<String, Object> details) {

    public ServiceHealth {
        details = details == null ? Map.of() : Map.copyOf(details);
    }

    public static ServiceHealth unknown(String id, String name, String monitoringType, String reason) {
        return new ServiceHealth(id, name, HealthStatus.UNKNOWN, monitoringType, null,
                Instant.now(), null, reason, Map.of());
    }

    public ServiceHealth withLastSuccessfulAt(Instant previous) {
        Instant successful = status == HealthStatus.UP || status == HealthStatus.DEGRADED
                ? lastCheckedAt : previous;
        return new ServiceHealth(id, name, status, monitoringType, latencyMs, lastCheckedAt,
                successful, error, details);
    }

    public ServiceHealth stale() {
        return new ServiceHealth(id, name, HealthStatus.STALE, monitoringType, latencyMs,
                lastCheckedAt, lastSuccessfulAt, "Monitoring data is stale", details);
    }

    public Map<String, Object> toSafeMap() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", id);
        value.put("name", name);
        value.put("status", status.name());
        value.put("monitoringType", monitoringType);
        if (latencyMs != null) value.put("latencyMs", latencyMs);
        if (lastCheckedAt != null) value.put("lastCheckedAt", lastCheckedAt);
        if (lastSuccessfulAt != null) value.put("lastSuccessfulAt", lastSuccessfulAt);
        if (error != null && !error.isBlank()) value.put("error", error);
        if (!details.isEmpty()) value.put("details", details);
        return value;
    }
}
