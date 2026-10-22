package com.devops.dashboard.monitoring;

public interface InfrastructureProbe {
    String id();
    String name();
    String monitoringType();
    ServiceHealth check() throws Exception;
}
