package com.devops.dashboard.config;

import com.devops.dashboard.cache.CacheService;
import com.devops.dashboard.repository.RecordRepository;
import com.devops.dashboard.service.CacheDemoService;
import com.devops.dashboard.service.InstanceService;
import com.devops.dashboard.monitoring.*;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Application lifecycle listener: initializes and tears down shared services.
 * Services are stored as servlet context attributes for access by servlets.
 */
@WebListener
public class AppLifecycleListener implements ServletContextListener {
    private static final Logger log = LoggerFactory.getLogger(AppLifecycleListener.class);

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        log.info("=== DevOps Infrastructure Dashboard Starting ===");

        try {
            // Initialize configuration
            AppConfig config = AppConfig.getInstance();
            log.info("Instance: {} | Environment: {}", config.getInstanceId(), config.getAppEnv());

            // Create services
            InstanceService instanceService = new InstanceService();
            RecordRepository recordRepository = new RecordRepository();
            CacheService cacheService = new CacheService();
            CacheDemoService cacheDemoService = new CacheDemoService(recordRepository, cacheService);
            InfrastructureMonitoringService monitoringService = null;
            try {
                monitoringService = createMonitoringService(config, recordRepository, cacheService);
            } catch (RuntimeException e) {
                log.error("Infrastructure monitoring configuration is invalid; application will continue without it: {}", e.getMessage());
            }

            // Initialize database table
            try {
                recordRepository.initializeTable();
                log.info("Database initialized successfully");
            } catch (Exception e) {
                log.warn("Database initialization failed (MySQL may not be available): {}", e.getMessage());
            }

            // Store services in servlet context
            ServletContext ctx = sce.getServletContext();
            ctx.setAttribute("instanceService", instanceService);
            ctx.setAttribute("recordRepository", recordRepository);
            ctx.setAttribute("cacheService", cacheService);
            ctx.setAttribute("cacheDemoService", cacheDemoService);
            if (monitoringService != null) ctx.setAttribute("infrastructureMonitoringService", monitoringService);

            log.info("=== DevOps Infrastructure Dashboard Started ===");
        } catch (Exception e) {
            log.error("Failed to initialize application: {}", e.getMessage(), e);
        }
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        log.info("=== DevOps Infrastructure Dashboard Shutting Down ===");

        try {
            Object service = sce.getServletContext().getAttribute("infrastructureMonitoringService");
            if (service instanceof InfrastructureMonitoringService monitoringService) monitoringService.close();
        } catch (Exception e) {
            log.warn("Error shutting down infrastructure monitoring: {}", e.getMessage());
        }

        try {
            MemcachedConfig.shutdown();
        } catch (Exception e) {
            log.warn("Error shutting down Memcached: {}", e.getMessage());
        }

        try {
            DatabaseConfig.shutdown();
        } catch (Exception e) {
            log.warn("Error shutting down database pool: {}", e.getMessage());
        }

        log.info("=== DevOps Infrastructure Dashboard Stopped ===");
    }

    private InfrastructureMonitoringService createMonitoringService(AppConfig config,
                                                                     RecordRepository repository,
                                                                     CacheService cacheService) {
        Duration timeout = Duration.ofMillis(config.getInfraMonitoringTimeoutMs());
        List<InfrastructureProbe> probes = new ArrayList<>();
        probes.add(new HttpStatusProbe("web01", "Nginx", config.getNginxHealthUrl(), timeout));
        probes.add(new TomcatPeerProbe("app01", config.getApp01HealthUrl(), timeout));
        probes.add(new TomcatPeerProbe("app02", config.getApp02HealthUrl(), timeout));
        probes.add(new FunctionalProbe("db01", "MySQL", "JDBC", () -> {
            long start = System.nanoTime();
            long ping = repository.pingDatabase();
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("version", repository.getDatabaseVersion());
            details.put("pingLatencyMs", ping);
            details.put("connectionPool", DatabaseConfig.getPoolStats());
            return new ServiceHealth("db01", "MySQL", HealthStatus.UP, "JDBC", elapsed(start),
                    Instant.now(), null, null, details);
        }));
        probes.add(new FunctionalProbe("mc01", "Memcached", "MEMCACHED_READ_WRITE", () -> {
            Map<String, Object> health = cacheService.healthCheck();
            String rawStatus = String.valueOf(health.getOrDefault("status", "DOWN"));
            HealthStatus status = switch (rawStatus) {
                case "UP" -> HealthStatus.UP;
                case "CHECKING" -> HealthStatus.CHECKING;
                default -> HealthStatus.DOWN;
            };
            Long latency = health.get("latencyMs") instanceof Number n ? n.longValue() : null;
            String error = health.get("error") == null ? null : String.valueOf(health.get("error"));
            Map<String, Object> details = new LinkedHashMap<>(health);
            details.remove("status"); details.remove("latencyMs"); details.remove("error");
            return new ServiceHealth("mc01", "Memcached", status, "MEMCACHED_READ_WRITE", latency,
                    Instant.now(), null, error, details);
        }));
        probes.add(new RabbitMqProbe(config.getRabbitMqHost(), config.getRabbitMqPort(),
                config.getRabbitMqManagementUrl(), config.getRabbitMqVhost(), config.getRabbitMqMonitorUsername(),
                config.getRabbitMqMonitorPassword(), timeout));
        probes.add(new NfsProbe(config.getNfsMountPath(), config.getNfsExpectedServer(),
                config.getNfsExpectedExport(), config.isNfsWriteProbeEnabled()));
        log.info("Infrastructure monitoring: enabled={}, interval={}s, probes={}",
                config.isInfraMonitoringEnabled(), config.getInfraMonitoringIntervalSeconds(), probes.size());
        return new InfrastructureMonitoringService(probes, config.isInfraMonitoringEnabled(),
                Duration.ofSeconds(config.getInfraMonitoringIntervalSeconds()), timeout);
    }

    private static long elapsed(long start) { return (System.nanoTime() - start) / 1_000_000; }
}
