package com.devops.dashboard.monitoring;

import java.util.concurrent.Callable;

public record FunctionalProbe(String id, String name, String monitoringType,
                              Callable<ServiceHealth> action) implements InfrastructureProbe {
    @Override public ServiceHealth check() throws Exception { return action.call(); }
}
