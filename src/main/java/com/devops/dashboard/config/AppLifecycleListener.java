package com.devops.dashboard.config;

import com.devops.dashboard.cache.CacheService;
import com.devops.dashboard.repository.RecordRepository;
import com.devops.dashboard.service.CacheDemoService;
import com.devops.dashboard.service.InstanceService;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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

            log.info("=== DevOps Infrastructure Dashboard Started ===");
        } catch (Exception e) {
            log.error("Failed to initialize application: {}", e.getMessage(), e);
        }
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        log.info("=== DevOps Infrastructure Dashboard Shutting Down ===");

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
}
