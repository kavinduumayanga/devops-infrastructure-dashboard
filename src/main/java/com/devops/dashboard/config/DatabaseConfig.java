package com.devops.dashboard.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Manages the HikariCP connection pool lifecycle.
 */
public final class DatabaseConfig {
    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    private static volatile HikariDataSource dataSource;

    private DatabaseConfig() {}

    public static DataSource getDataSource() {
        if (dataSource == null) {
            synchronized (DatabaseConfig.class) {
                if (dataSource == null) {
                    dataSource = createDataSource();
                }
            }
        }
        return dataSource;
    }

    private static HikariDataSource createDataSource() {
        AppConfig config = AppConfig.getInstance();
        HikariConfig hikari = new HikariConfig();
        hikari.setJdbcUrl(config.getDbJdbcUrl());
        hikari.setUsername(config.getDbUser());
        hikari.setPassword(config.getDbPassword());
        hikari.setMaximumPoolSize(config.getDbPoolSize());
        hikari.setMinimumIdle(1);
        hikari.setConnectionTimeout(config.getDbConnectionTimeout());
        hikari.setIdleTimeout(300000);
        hikari.setMaxLifetime(600000);
        hikari.setPoolName("devops-dashboard-pool");
        hikari.setConnectionTestQuery("SELECT 1");
        hikari.addDataSourceProperty("cachePrepStmts", "true");
        hikari.addDataSourceProperty("prepStmtCacheSize", "25");
        hikari.addDataSourceProperty("prepStmtCacheSqlLimit", "256");

        log.info("Creating HikariCP pool: url={}, user={}, poolSize={}",
                config.getDbJdbcUrl(), config.getDbUser(), config.getDbPoolSize());

        return new HikariDataSource(hikari);
    }

    public static boolean isInitialized() {
        return dataSource != null && !dataSource.isClosed();
    }

    public static Map<String, Object> getPoolStats() {
        HikariDataSource pool = dataSource;
        Map<String, Object> stats = new LinkedHashMap<>();
        if (pool == null || pool.isClosed() || pool.getHikariPoolMXBean() == null) {
            stats.put("status", "UNAVAILABLE");
            return stats;
        }

        var poolMxBean = pool.getHikariPoolMXBean();
        stats.put("status", "AVAILABLE");
        stats.put("activeConnections", poolMxBean.getActiveConnections());
        stats.put("idleConnections", poolMxBean.getIdleConnections());
        stats.put("totalConnections", poolMxBean.getTotalConnections());
        stats.put("threadsAwaitingConnection", poolMxBean.getThreadsAwaitingConnection());
        return stats;
    }

    public static void shutdown() {
        if (dataSource != null && !dataSource.isClosed()) {
            log.info("Shutting down HikariCP connection pool");
            dataSource.close();
            dataSource = null;
        }
    }
}
