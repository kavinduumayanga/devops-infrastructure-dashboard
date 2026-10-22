package com.devops.dashboard.monitoring;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/** Direct HTTP status probe for an operator-configured target (never browser supplied). */
public final class HttpStatusProbe implements InfrastructureProbe {
    private final String id;
    private final String name;
    private final URI uri;
    private final Duration timeout;
    private final HttpClient client;

    public HttpStatusProbe(String id, String name, String url, Duration timeout) {
        this(id, name, validate(url), timeout, HttpClient.newBuilder()
                .connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER).build());
    }

    HttpStatusProbe(String id, String name, URI uri, Duration timeout, HttpClient client) {
        this.id = id;
        this.name = name;
        this.uri = uri;
        this.timeout = timeout;
        this.client = client;
    }

    private static URI validate(String value) {
        URI uri = URI.create(value);
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                || uri.getHost() == null || uri.getUserInfo() != null) {
            throw new IllegalArgumentException("Monitoring URL must be an absolute HTTP(S) URL");
        }
        return uri;
    }

    public String id() { return id; }
    public String name() { return name; }
    public String monitoringType() { return "HTTP"; }

    @Override
    public ServiceHealth check() throws Exception {
        long start = System.nanoTime();
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(timeout).GET()
                .header("Accept", "text/plain").build();
        HttpResponse<Void> response = client.send(request, HttpResponse.BodyHandlers.discarding());
        long latency = (System.nanoTime() - start) / 1_000_000;
        boolean healthy = response.statusCode() >= 200 && response.statusCode() < 300;
        return new ServiceHealth(id, name, healthy ? HealthStatus.UP : HealthStatus.DOWN, monitoringType(),
                latency, Instant.now(), null, healthy ? null : "HTTP status " + response.statusCode(),
                Map.of("httpStatus", response.statusCode()));
    }
}
