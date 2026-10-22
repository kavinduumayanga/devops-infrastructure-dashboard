package com.devops.dashboard.monitoring;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class RabbitMqProbeTest {
    private HttpServer server;
    @AfterEach void stop() { if (server != null) server.stop(0); }

    @Test void readsManagementOverviewWithoutExposingCredentials() throws Exception {
        start(200, "{\"rabbitmq_version\":\"4.2.9\",\"object_totals\":{\"queues\":3,\"connections\":2},\"queue_totals\":{\"messages\":7}}");
        ServiceHealth health = probe("secret-value").check();
        assertEquals(HealthStatus.UP, health.status());
        assertEquals(3L, health.details().get("queueCount"));
        assertFalse(health.toString().contains("secret-value"));
    }

    @Test void reportsAuthenticationFailureSafely() throws Exception {
        start(401, "denied");
        ServiceHealth health = probe("very-secret").check();
        assertEquals(HealthStatus.DOWN, health.status());
        assertTrue(health.error().contains("authentication"));
        assertFalse(health.error().contains("very-secret"));
    }

    private RabbitMqProbe probe(String password) {
        return new RabbitMqProbe("127.0.0.1", 5672,
                "http://127.0.0.1:" + server.getAddress().getPort(), "devops", "monitor", password, Duration.ofSeconds(1));
    }

    private void start(int status, String body) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/overview", exchange -> {
            byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.createContext("/api/health/checks/alarms", exchange -> {
            byte[] bytes = "{\"status\":\"ok\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.createContext("/api/nodes", exchange -> {
            byte[] bytes = "[{\"mem_used\":1048576}]".getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
    }
}
