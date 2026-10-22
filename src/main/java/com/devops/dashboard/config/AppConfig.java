package com.devops.dashboard.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Centralized application configuration.
 * All values are loaded from environment variables with safe defaults.
 */
public final class AppConfig {
    private static final Logger log = LoggerFactory.getLogger(AppConfig.class);

    // Application
    private final String appEnv;
    private final String instanceId;

    // Database
    private final String dbHost;
    private final int dbPort;
    private final String dbName;
    private final String dbUser;
    private final String dbPassword;
    private final int dbPoolSize;
    private final long dbConnectionTimeout;

    // Memcached
    private final String memcachedHost;
    private final int memcachedPort;
    private final int cacheTtlSeconds;
    private final long cacheOperationTimeoutMs;

    // Infrastructure monitoring
    private final boolean infraMonitoringEnabled;
    private final int infraMonitoringIntervalSeconds;
    private final int infraMonitoringTimeoutMs;
    private final String nginxHealthUrl;
    private final String app01HealthUrl;
    private final String app02HealthUrl;
    private final String rabbitMqHost;
    private final int rabbitMqPort;
    private final String rabbitMqManagementUrl;
    private final String rabbitMqVhost;
    private final String rabbitMqMonitorUsername;
    private final String rabbitMqMonitorPassword;
    private final String nfsMountPath;
    private final String nfsExpectedServer;
    private final String nfsExpectedExport;
    private final boolean nfsWriteProbeEnabled;

    private static volatile AppConfig instance;

    private AppConfig() {
        this.appEnv = env("APP_ENV", "development");
        this.instanceId = env("APP_INSTANCE_ID", resolveHostname());

        this.dbHost = env("DB_HOST", "localhost");
        this.dbPort = envInt("DB_PORT", 3306);
        this.dbName = env("DB_NAME", "devops_demo");
        this.dbUser = env("DB_USER", "admin");
        this.dbPassword = env("DB_PASSWORD", "");
        this.dbPoolSize = envInt("DB_POOL_SIZE", 5);
        this.dbConnectionTimeout = envLong("DB_CONNECTION_TIMEOUT_MS", 5000L);

        this.memcachedHost = env("MEMCACHED_HOST", "localhost");
        this.memcachedPort = envInt("MEMCACHED_PORT", 11211);
        this.cacheTtlSeconds = envInt("CACHE_TTL_SECONDS", 60);
        this.cacheOperationTimeoutMs = envLong("CACHE_OPERATION_TIMEOUT_MS", 3000L);

        this.infraMonitoringEnabled = envBoolean("INFRA_MONITORING_ENABLED", false);
        this.infraMonitoringIntervalSeconds = boundedInt("INFRA_MONITORING_INTERVAL_SECONDS", 15, 5, 3600);
        this.infraMonitoringTimeoutMs = boundedInt("INFRA_MONITORING_TIMEOUT_MS", 3000, 250, 30000);
        this.nginxHealthUrl = env("NGINX_HEALTH_URL", "http://192.168.56.20/nginx-health");
        this.app01HealthUrl = env("APP01_HEALTH_URL", "http://192.168.56.22:8080/devops-dashboard/api/instance");
        this.app02HealthUrl = env("APP02_HEALTH_URL", "http://192.168.56.21:8080/devops-dashboard/api/instance");
        this.rabbitMqHost = env("RABBITMQ_HOST", "192.168.56.23");
        this.rabbitMqPort = envInt("RABBITMQ_PORT", 5672);
        this.rabbitMqManagementUrl = env("RABBITMQ_MANAGEMENT_URL", "");
        this.rabbitMqVhost = env("RABBITMQ_VHOST", "devops");
        this.rabbitMqMonitorUsername = env("RABBITMQ_MONITOR_USERNAME", "");
        this.rabbitMqMonitorPassword = env("RABBITMQ_MONITOR_PASSWORD", "");
        this.nfsMountPath = env("NFS_MOUNT_PATH", "/mnt/nfs-shared");
        this.nfsExpectedServer = env("NFS_EXPECTED_SERVER", "192.168.56.26");
        this.nfsExpectedExport = env("NFS_EXPECTED_EXPORT", "/srv/nfs/shared");
        this.nfsWriteProbeEnabled = envBoolean("NFS_WRITE_PROBE_ENABLED", false);

        log.info("Configuration loaded: env={}, instanceId={}, db={}:{}/{}, memcached={}:{}",
                appEnv, instanceId, dbHost, dbPort, dbName, memcachedHost, memcachedPort);
    }

    public static AppConfig getInstance() {
        if (instance == null) {
            synchronized (AppConfig.class) {
                if (instance == null) {
                    instance = new AppConfig();
                }
            }
        }
        return instance;
    }

    /** Reset singleton for testing or reloading */
    public static synchronized void reset() {
        instance = null;
    }

    private static String resolveHostname() {
        try {
            return java.net.InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private static String env(String key, String defaultValue) {
        String value = System.getenv(key);
        return (value != null && !value.isBlank()) ? value.trim() : defaultValue;
    }

    private static int envInt(String key, int defaultValue) {
        try {
            return Integer.parseInt(env(key, String.valueOf(defaultValue)));
        } catch (NumberFormatException e) {
            log.warn("Invalid integer for env var {}, using default {}", key, defaultValue);
            return defaultValue;
        }
    }

    private static long envLong(String key, long defaultValue) {
        try {
            return Long.parseLong(env(key, String.valueOf(defaultValue)));
        } catch (NumberFormatException e) {
            log.warn("Invalid long for env var {}, using default {}", key, defaultValue);
            return defaultValue;
        }
    }

    private static boolean envBoolean(String key, boolean defaultValue) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? defaultValue : Boolean.parseBoolean(value.trim());
    }

    private static int boundedInt(String key, int defaultValue, int min, int max) {
        return Math.max(min, Math.min(max, envInt(key, defaultValue)));
    }

    // Getters
    public String getAppEnv() { return appEnv; }
    public String getInstanceId() { return instanceId; }
    public String getDbHost() { return dbHost; }
    public int getDbPort() { return dbPort; }
    public String getDbName() { return dbName; }
    public String getDbUser() { return dbUser; }
    public String getDbPassword() { return dbPassword; }
    public int getDbPoolSize() { return dbPoolSize; }
    public long getDbConnectionTimeout() { return dbConnectionTimeout; }
    public String getMemcachedHost() { return memcachedHost; }
    public int getMemcachedPort() { return memcachedPort; }
    public int getCacheTtlSeconds() { return cacheTtlSeconds; }
    public long getCacheOperationTimeoutMs() { return cacheOperationTimeoutMs; }
    public boolean isInfraMonitoringEnabled() { return infraMonitoringEnabled; }
    public int getInfraMonitoringIntervalSeconds() { return infraMonitoringIntervalSeconds; }
    public int getInfraMonitoringTimeoutMs() { return infraMonitoringTimeoutMs; }
    public String getNginxHealthUrl() { return nginxHealthUrl; }
    public String getApp01HealthUrl() { return app01HealthUrl; }
    public String getApp02HealthUrl() { return app02HealthUrl; }
    public String getRabbitMqHost() { return rabbitMqHost; }
    public int getRabbitMqPort() { return rabbitMqPort; }
    public String getRabbitMqManagementUrl() { return rabbitMqManagementUrl; }
    public String getRabbitMqVhost() { return rabbitMqVhost; }
    public String getRabbitMqMonitorUsername() { return rabbitMqMonitorUsername; }
    public String getRabbitMqMonitorPassword() { return rabbitMqMonitorPassword; }
    public String getNfsMountPath() { return nfsMountPath; }
    public String getNfsExpectedServer() { return nfsExpectedServer; }
    public String getNfsExpectedExport() { return nfsExpectedExport; }
    public boolean isNfsWriteProbeEnabled() { return nfsWriteProbeEnabled; }

    public String getDbJdbcUrl() {
        return String.format("jdbc:mysql://%s:%d/%s?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8",
                dbHost, dbPort, dbName);
    }
}
