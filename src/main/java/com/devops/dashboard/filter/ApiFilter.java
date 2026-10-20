package com.devops.dashboard.filter;

import com.devops.dashboard.config.AppConfig;
import jakarta.servlet.*;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import java.io.IOException;
import java.util.UUID;

/**
 * Filter that adds request ID, instance ID headers, CORS, and logging to all API requests.
 */
@WebFilter(urlPatterns = "/api/*")
public class ApiFilter implements Filter {
    private static final Logger log = LoggerFactory.getLogger(ApiFilter.class);

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        // Generate request ID
        String requestId = UUID.randomUUID().toString().substring(0, 8);
        MDC.put("requestId", requestId);

        String instanceId = AppConfig.getInstance().getInstanceId();

        // Set response headers
        res.setHeader("X-Request-Id", requestId);
        res.setHeader("X-App-Instance", instanceId);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");

        // CORS headers (restrictive - same origin or configured origins)
        String origin = req.getHeader("Origin");
        if (origin != null) {
            // In development, allow localhost origins
            String env = AppConfig.getInstance().getAppEnv();
            if ("development".equals(env) && isLocalDevelopmentOrigin(origin)) {
                res.setHeader("Access-Control-Allow-Origin", origin);
                res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
                res.setHeader("Access-Control-Expose-Headers", "X-Request-Id, X-App-Instance");
                res.setHeader("Access-Control-Max-Age", "3600");
            }
        }

        // Handle CORS preflight
        if ("OPTIONS".equalsIgnoreCase(req.getMethod())) {
            res.setStatus(HttpServletResponse.SC_OK);
            MDC.remove("requestId");
            return;
        }

        long start = System.nanoTime();

        try {
            chain.doFilter(request, response);
        } finally {
            long durationMs = (System.nanoTime() - start) / 1_000_000;
            log.info("{} {} {} {}ms [{}]",
                    req.getMethod(),
                    req.getRequestURI(),
                    res.getStatus(),
                    durationMs,
                    instanceId);
            MDC.remove("requestId");
        }
    }

    private boolean isLocalDevelopmentOrigin(String origin) {
        try {
            java.net.URI uri = java.net.URI.create(origin);
            String host = uri.getHost();
            return ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
                    && host != null
                    && (host.equalsIgnoreCase("localhost")
                    || host.equals("127.0.0.1")
                    || host.equals("::1"));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
