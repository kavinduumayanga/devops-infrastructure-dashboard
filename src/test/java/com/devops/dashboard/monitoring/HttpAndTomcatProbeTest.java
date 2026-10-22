package com.devops.dashboard.monitoring;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class HttpAndTomcatProbeTest {
    private HttpServer server;

    @AfterEach void stop() { if (server != null) server.stop(0); }

    @Test void nginxHealthyAndHttpFailureAreRealStatuses() throws Exception {
        start("/nginx-health", 200, "healthy\n");
        ServiceHealth up = new HttpStatusProbe("web01", "Nginx", url("/nginx-health"), Duration.ofSeconds(1)).check();
        assertEquals(HealthStatus.UP, up.status());
        assertNotNull(up.latencyMs());

        ServiceHealth down = new HttpStatusProbe("web01", "Nginx", url("/missing"), Duration.ofSeconds(1)).check();
        assertEquals(HealthStatus.DOWN, down.status());
        assertEquals(404, down.details().get("httpStatus"));
    }

    @Test void tomcatValidatesReturnedInstanceIdentity() throws Exception {
        start("/api/instance", 200, "{\"success\":true,\"data\":{\"instanceId\":\"app01\",\"hostname\":\"app01\"}}");
        assertEquals(HealthStatus.UP, new TomcatPeerProbe("app01", url("/api/instance"), Duration.ofSeconds(1)).check().status());
        ServiceHealth mismatch = new TomcatPeerProbe("app02", url("/api/instance"), Duration.ofSeconds(1)).check();
        assertEquals(HealthStatus.DOWN, mismatch.status());
        assertEquals("app01", mismatch.details().get("observedInstanceId"));
    }

    private void start(String path, int status, String body) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(path, exchange -> {
            byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
    }

    private String url(String path) { return "http://127.0.0.1:" + server.getAddress().getPort() + path; }
}
