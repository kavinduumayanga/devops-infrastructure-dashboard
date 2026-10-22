package com.devops.dashboard.monitoring;

import java.time.Instant;
import java.util.List;

public record InfrastructureHealthSnapshot(
        Instant checkedAt,
        boolean monitoringEnabled,
        boolean stale,
        List<ServiceHealth> services) {
    public InfrastructureHealthSnapshot {
        services = List.copyOf(services);
    }
}
