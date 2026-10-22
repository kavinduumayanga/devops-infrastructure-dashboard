package com.devops.dashboard.monitoring;

import com.devops.dashboard.util.JsonUtil;
import com.fasterxml.jackson.databind.JsonNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public final class TomcatPeerProbe implements InfrastructureProbe {
    private final String expectedId;
    private final URI uri;
    private final Duration timeout;
    private final HttpClient client;

    public TomcatPeerProbe(String expectedId, String url, Duration timeout) {
        this.expectedId = expectedId;
        this.uri = URI.create(url);
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("Tomcat monitoring URL must be absolute HTTP(S)");
        }
        this.timeout = timeout;
        this.client = HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER).build();
    }

    public String id() { return expectedId; }
    public String name() { return "Apache Tomcat"; }
    public String monitoringType() { return "DIRECT_HTTP_INSTANCE"; }

    @Override
    public ServiceHealth check() throws Exception {
        long start = System.nanoTime();
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(uri).timeout(timeout)
                .header("Accept", "application/json").GET().build(), HttpResponse.BodyHandlers.ofString());
        long latency = (System.nanoTime() - start) / 1_000_000;
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            return result(HealthStatus.DOWN, latency, "HTTP status " + response.statusCode(), Map.of());
        }
        JsonNode data = JsonUtil.getMapper().readTree(response.body()).path("data");
        String observedId = data.path("instanceId").asText("");
        if (!expectedId.equals(observedId)) {
            return result(HealthStatus.DOWN, latency, "Instance identity mismatch", Map.of("observedInstanceId", observedId));
        }
        Map<String, Object> details = new LinkedHashMap<>();
        addText(details, "hostname", data.path("hostname"));
        addText(details, "javaVersion", data.path("javaVersion"));
        addText(details, "uptime", data.path("uptime"));
        return result(HealthStatus.UP, latency, null, details);
    }

    private void addText(Map<String, Object> details, String key, JsonNode value) {
        if (!value.isMissingNode() && !value.asText().isBlank()) details.put(key, value.asText());
    }

    private ServiceHealth result(HealthStatus status, long latency, String error, Map<String, Object> details) {
        return new ServiceHealth(expectedId, name(), status, monitoringType(), latency, Instant.now(), null, error, details);
    }
}
