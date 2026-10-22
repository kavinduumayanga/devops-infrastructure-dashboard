package com.devops.dashboard.config;

import net.spy.memcached.AddrUtil;
import net.spy.memcached.ConnectionFactoryBuilder;
import net.spy.memcached.MemcachedClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

/**
 * Manages the Memcached client lifecycle.
 */
public final class MemcachedConfig {
    private static final Logger log = LoggerFactory.getLogger(MemcachedConfig.class);

    private static volatile MemcachedClient client;
    private static volatile long initializationStartedAtMs;

    private MemcachedConfig() {}

    public static MemcachedClient getClient() {
        if (client == null) {
            synchronized (MemcachedConfig.class) {
                if (client == null) {
                    initializationStartedAtMs = System.currentTimeMillis();
                    client = createClient();
                }
            }
        }
        return client;
    }

    private static MemcachedClient createClient() {
        AppConfig config = AppConfig.getInstance();
        String address = config.getMemcachedHost() + ":" + config.getMemcachedPort();
        log.info("Connecting to Memcached: {}", address);

        try {
            ConnectionFactoryBuilder builder = new ConnectionFactoryBuilder();
            builder.setOpTimeout(config.getCacheOperationTimeoutMs());
            builder.setDaemon(true);
            builder.setFailureMode(net.spy.memcached.FailureMode.Retry);

            return new MemcachedClient(builder.build(), AddrUtil.getAddresses(address));
        } catch (IOException e) {
            log.error("Failed to connect to Memcached at {}: {}", address, e.getMessage());
            return null;
        }
    }

    public static boolean isAvailable() {
        try {
            MemcachedClient c = getClient();
            return c != null && !c.getAvailableServers().isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    public static boolean isInitializing() {
        return client != null && client.getAvailableServers().isEmpty()
                && System.currentTimeMillis() - initializationStartedAtMs
                < AppConfig.getInstance().getCacheOperationTimeoutMs() * 2;
    }

    public static void shutdown() {
        if (client != null) {
            log.info("Shutting down Memcached client");
            try {
                client.shutdown();
            } catch (Exception e) {
                log.warn("Error shutting down Memcached client: {}", e.getMessage());
            }
            client = null;
            initializationStartedAtMs = 0;
        }
    }
}
