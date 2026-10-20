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

    private static volatile AppConfig instance;

    private AppConfig() {
        this.appEnv = env("APP_ENV", "development");
        this.instanceId = env("APP_INSTANCE_ID", resolveHostname());

        this.dbHost = env("DB_HOST", "localhost");
        this.dbPort = envInt("DB_PORT", 3306);
        this.dbName = env("DB_NAME", "devops_demo");
        this.dbUser = env("DB_USER", "devops_user");
        this.dbPassword = env("DB_PASSWORD", "");
        this.dbPoolSize = envInt("DB_POOL_SIZE", 5);
        this.dbConnectionTimeout = envLong("DB_CONNECTION_TIMEOUT_MS", 5000L);

        this.memcachedHost = env("MEMCACHED_HOST", "localhost");
        this.memcachedPort = envInt("MEMCACHED_PORT", 11211);
        this.cacheTtlSeconds = envInt("CACHE_TTL_SECONDS", 60);
        this.cacheOperationTimeoutMs = envLong("CACHE_OPERATION_TIMEOUT_MS", 3000L);

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

    public String getDbJdbcUrl() {
        return String.format("jdbc:mysql://%s:%d/%s?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8",
                dbHost, dbPort, dbName);
    }
}
