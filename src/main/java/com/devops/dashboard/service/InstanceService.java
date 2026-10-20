package com.devops.dashboard.service;

import com.devops.dashboard.config.AppConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.RuntimeMXBean;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Service for collecting instance and system information.
 */
public class InstanceService {
    private static final Logger log = LoggerFactory.getLogger(InstanceService.class);

    private final Instant startupTime;

    public InstanceService() {
        this.startupTime = Instant.now();
    }

    /**
     * Returns instance identification and runtime info.
     */
    public Map<String, Object> getInstanceInfo() {
        AppConfig config = AppConfig.getInstance();
        Map<String, Object> info = new LinkedHashMap<>();

        info.put("instanceId", config.getInstanceId());
        info.put("hostname", getHostname());
        info.put("javaVersion", System.getProperty("java.version"));
        info.put("javaVendor", System.getProperty("java.vendor"));
        info.put("status", "UP");
        info.put("timestamp", Instant.now().toString());
        info.put("environment", config.getAppEnv());

        // JVM uptime
        RuntimeMXBean runtime = ManagementFactory.getRuntimeMXBean();
        long uptimeMs = runtime.getUptime();
        info.put("uptimeMs", uptimeMs);
        info.put("uptime", formatDuration(Duration.ofMillis(uptimeMs)));
        info.put("startTime", Instant.ofEpochMilli(runtime.getStartTime()).toString());

        return info;
    }

    /**
     * Returns detailed system information.
     */
    public Map<String, Object> getSystemInfo() {
        Map<String, Object> info = new LinkedHashMap<>();

        // Instance
        AppConfig config = AppConfig.getInstance();
        info.put("instanceId", config.getInstanceId());
        info.put("hostname", getHostname());
        info.put("environment", config.getAppEnv());

        // OS
        info.put("osName", System.getProperty("os.name"));
        info.put("osVersion", System.getProperty("os.version"));
        info.put("osArch", System.getProperty("os.arch"));

        // Java
        info.put("javaVersion", System.getProperty("java.version"));
        info.put("javaVendor", System.getProperty("java.vendor"));
        info.put("javaHome", "***REDACTED***");

        // JVM Runtime
        RuntimeMXBean runtime = ManagementFactory.getRuntimeMXBean();
        long uptimeMs = runtime.getUptime();
        info.put("jvmUptime", formatDuration(Duration.ofMillis(uptimeMs)));
        info.put("jvmUptimeMs", uptimeMs);
        info.put("jvmStartTime", Instant.ofEpochMilli(runtime.getStartTime()).toString());
        info.put("jvmName", runtime.getVmName());
        info.put("jvmVendor", runtime.getVmVendor());
        info.put("jvmVersion", runtime.getVmVersion());

        // Memory
        MemoryMXBean memory = ManagementFactory.getMemoryMXBean();
        var heapUsage = memory.getHeapMemoryUsage();
        info.put("heapUsedMB", heapUsage.getUsed() / (1024 * 1024));
        info.put("heapMaxMB", heapUsage.getMax() / (1024 * 1024));
        info.put("heapCommittedMB", heapUsage.getCommitted() / (1024 * 1024));

        Runtime rt = Runtime.getRuntime();
        info.put("availableProcessors", rt.availableProcessors());
        info.put("freeMemoryMB", rt.freeMemory() / (1024 * 1024));
        info.put("totalMemoryMB", rt.totalMemory() / (1024 * 1024));
        info.put("maxMemoryMB", rt.maxMemory() / (1024 * 1024));

        return info;
    }

    private String getHostname() {
        try {
            return java.net.InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return AppConfig.getInstance().getInstanceId();
        }
    }

    private String formatDuration(Duration duration) {
        long days = duration.toDays();
        long hours = duration.toHoursPart();
        long minutes = duration.toMinutesPart();
        long seconds = duration.toSecondsPart();

        if (days > 0) {
            return String.format("%dd %dh %dm %ds", days, hours, minutes, seconds);
        } else if (hours > 0) {
            return String.format("%dh %dm %ds", hours, minutes, seconds);
        } else if (minutes > 0) {
            return String.format("%dm %ds", minutes, seconds);
        } else {
            return String.format("%ds", seconds);
        }
    }
}
