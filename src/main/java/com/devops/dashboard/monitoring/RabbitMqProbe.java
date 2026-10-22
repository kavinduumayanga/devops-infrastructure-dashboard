package com.devops.dashboard.monitoring;

import com.devops.dashboard.util.JsonUtil;
import com.fasterxml.jackson.databind.JsonNode;

import java.net.*;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

public final class RabbitMqProbe implements InfrastructureProbe {
    private final String host;
    private final int port;
    private final String managementUrl;
    private final String vhost;
    private final String username;
    private final String password;
    private final Duration timeout;

    public RabbitMqProbe(String host, int port, String managementUrl, String vhost,
                         String username, String password, Duration timeout) {
        this.host = host;
        this.port = port;
        this.managementUrl = managementUrl == null ? "" : managementUrl.replaceAll("/+$", "");
        this.vhost = vhost == null || vhost.isBlank() ? "/" : vhost;
        this.username = username == null ? "" : username;
        this.password = password == null ? "" : password;
        this.timeout = timeout;
    }

    public String id() { return "rmq01"; }
    public String name() { return "RabbitMQ"; }
    public String monitoringType() { return managementConfigured() ? "MANAGEMENT_HTTP" : "TCP_CONNECTIVITY_ONLY"; }

    @Override
    public ServiceHealth check() throws Exception {
        return managementConfigured() ? managementCheck() : tcpCheck();
    }

    private boolean managementConfigured() {
        return !managementUrl.isBlank() && !username.isBlank() && !password.isBlank();
    }

    private ServiceHealth managementCheck() throws Exception {
        URI uri = URI.create(managementUrl + "/api/overview");
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("RabbitMQ management URL must be absolute HTTP(S)");
        }
        String authorization = Base64.getEncoder().encodeToString((username + ":" + password).getBytes(StandardCharsets.UTF_8));
        HttpClient client = HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER).build();
        long start = System.nanoTime();
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri).timeout(timeout).GET()
                .header("Accept", "application/json").header("Authorization", "Basic " + authorization).build(),
                HttpResponse.BodyHandlers.ofString());
        long latency = elapsed(start);
        if (response.statusCode() == 401 || response.statusCode() == 403) {
            return result(HealthStatus.DOWN, latency, "RabbitMQ management authentication failed", Map.of());
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            return result(HealthStatus.DOWN, latency, "RabbitMQ management returned HTTP " + response.statusCode(), Map.of());
        }
        JsonNode root = JsonUtil.getMapper().readTree(response.body());
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("vhost", vhost);
        add(details, "version", root.path("rabbitmq_version"));
        add(details, "queueCount", root.path("object_totals").path("queues"));
        add(details, "connectionCount", root.path("object_totals").path("connections"));
        add(details, "messageCount", root.path("queue_totals").path("messages"));

        // These endpoints add broker alarm state and real node memory usage.
        // They are requested in parallel and remain bounded by the same timeout.
        HttpRequest alarmsRequest = authenticatedRequest(managementUrl + "/api/health/checks/alarms", authorization);
        HttpRequest nodesRequest = authenticatedRequest(managementUrl + "/api/nodes", authorization);
        HealthStatus status = HealthStatus.UP;
        String error = null;
        CompletableFuture<HttpResponse<String>> alarmsFuture = client.sendAsync(alarmsRequest, HttpResponse.BodyHandlers.ofString());
        CompletableFuture<HttpResponse<String>> nodesFuture = client.sendAsync(nodesRequest, HttpResponse.BodyHandlers.ofString());
        try {
            CompletableFuture.allOf(alarmsFuture, nodesFuture).get(timeout.toMillis(), TimeUnit.MILLISECONDS);
            HttpResponse<String> alarms = alarmsFuture.join();
            if (alarms.statusCode() >= 200 && alarms.statusCode() < 300) {
                String alarmStatus = JsonUtil.getMapper().readTree(alarms.body()).path("status").asText("unknown");
                details.put("operationalStatus", alarmStatus);
                if (!"ok".equalsIgnoreCase(alarmStatus)) {
                    status = HealthStatus.DEGRADED;
                    error = "RabbitMQ reports an active resource alarm";
                }
            } else {
                status = HealthStatus.DEGRADED;
                error = "Broker alarm health endpoint returned HTTP " + alarms.statusCode();
            }

            HttpResponse<String> nodes = nodesFuture.join();
            if (nodes.statusCode() >= 200 && nodes.statusCode() < 300) {
                JsonNode nodeArray = JsonUtil.getMapper().readTree(nodes.body());
                if (nodeArray.isArray()) {
                    long memoryUsed = 0;
                    boolean memoryReported = false;
                    for (JsonNode node : nodeArray) {
                        if (node.path("mem_used").isIntegralNumber()) {
                            memoryUsed += node.path("mem_used").longValue();
                            memoryReported = true;
                        }
                    }
                    if (memoryReported) details.put("memoryUsedBytes", memoryUsed);
                }
            }
        } catch (Exception supplementalFailure) {
            alarmsFuture.cancel(true);
            nodesFuture.cancel(true);
            status = HealthStatus.DEGRADED;
            error = "Detailed broker health metrics are unavailable";
        }
        latency = elapsed(start);
        return result(status, latency, error, details);
    }

    private HttpRequest authenticatedRequest(String url, String authorization) {
        return HttpRequest.newBuilder(URI.create(url)).timeout(timeout).GET()
                .header("Accept", "application/json").header("Authorization", "Basic " + authorization).build();
    }

    private ServiceHealth tcpCheck() throws Exception {
        long start = System.nanoTime();
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), Math.toIntExact(timeout.toMillis()));
        }
        return result(HealthStatus.DEGRADED, elapsed(start),
                "Management API is not configured; TCP connectivity does not prove broker health",
                Map.of("tcpReachable", true));
    }

    private void add(Map<String, Object> details, String key, JsonNode value) {
        if (value.isIntegralNumber()) details.put(key, value.longValue());
        else if (value.isTextual() && !value.asText().isBlank()) details.put(key, value.asText());
    }

    private long elapsed(long start) { return (System.nanoTime() - start) / 1_000_000; }
    private ServiceHealth result(HealthStatus status, long latency, String error, Map<String, Object> details) {
        return new ServiceHealth(id(), name(), status, monitoringType(), latency, Instant.now(), null, error, details);
    }
}
