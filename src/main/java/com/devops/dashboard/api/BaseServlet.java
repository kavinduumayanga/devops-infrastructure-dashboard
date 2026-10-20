package com.devops.dashboard.api;

import com.devops.dashboard.config.AppConfig;
import com.devops.dashboard.dto.ApiResponse;
import com.devops.dashboard.util.JsonUtil;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.IOException;

/**
 * Base servlet providing JSON response helpers and common error handling.
 */
public abstract class BaseServlet extends HttpServlet {
    private static final int MAX_JSON_BODY_CHARS = 16_384;
    protected final Logger log = LoggerFactory.getLogger(getClass());

    /**
     * Write a success JSON response.
     */
    protected void writeJson(HttpServletResponse resp, int status, Object data) throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        resp.getWriter().write(JsonUtil.toJson(data));
    }

    /**
     * Write an ApiResponse with instance metadata.
     */
    protected <T> void writeApiResponse(HttpServletResponse resp, int status, ApiResponse<T> apiResponse) throws IOException {
        apiResponse.withInstanceId(AppConfig.getInstance().getInstanceId());
        String requestId = resp.getHeader("X-Request-Id");
        if (requestId != null) {
            apiResponse.withRequestId(requestId);
        }
        writeJson(resp, status, apiResponse);
    }

    /**
     * Write an error response.
     */
    protected void writeError(HttpServletResponse resp, int status, String error) throws IOException {
        writeApiResponse(resp, status, ApiResponse.error(error));
    }

    /**
     * Read JSON request body.
     */
    protected <T> T readJson(HttpServletRequest req, Class<T> clazz) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = req.getReader()) {
            char[] buffer = new char[1024];
            int read;
            while ((read = reader.read(buffer)) != -1) {
                if (sb.length() + read > MAX_JSON_BODY_CHARS) {
                    throw new IllegalArgumentException("Request body is too large");
                }
                sb.append(buffer, 0, read);
            }
        }
        if (sb.length() == 0) {
            throw new IllegalArgumentException("Request body is required");
        }
        try {
            T body = JsonUtil.fromJson(sb.toString(), clazz);
            if (body == null) {
                throw new IllegalArgumentException("Request body must be a JSON object");
            }
            return body;
        } catch (RuntimeException e) {
            if (e instanceof IllegalArgumentException) {
                throw e;
            }
            throw new IllegalArgumentException("Request body contains invalid JSON", e);
        }
    }

    /**
     * Extract path parameter after the servlet path.
     * E.g., for /api/records/42, returns "42"
     */
    protected String getPathParam(HttpServletRequest req) {
        String pathInfo = req.getPathInfo();
        if (pathInfo != null && pathInfo.length() > 1) {
            return pathInfo.substring(1); // Remove leading /
        }
        return null;
    }

    /**
     * Get a service from the servlet context.
     */
    @SuppressWarnings("unchecked")
    protected <T> T getService(String name) {
        return (T) getServletContext().getAttribute(name);
    }
}
