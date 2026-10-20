package com.devops.dashboard.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

/**
 * Standardized API response wrapper.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {
    private boolean success;
    private T data;
    private String message;
    private String error;
    private String instanceId;
    private String requestId;
    private Instant timestamp;
    private Long durationMs;
    private Map<String, Object> meta;

    private ApiResponse() {
        this.timestamp = Instant.now();
    }

    public static <T> ApiResponse<T> success(T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.success = true;
        response.data = data;
        return response;
    }

    public static <T> ApiResponse<T> success(T data, String message) {
        ApiResponse<T> response = success(data);
        response.message = message;
        return response;
    }

    public static <T> ApiResponse<T> error(String error) {
        ApiResponse<T> response = new ApiResponse<>();
        response.success = false;
        response.error = error;
        return response;
    }

    public static <T> ApiResponse<T> error(String error, String message) {
        ApiResponse<T> response = error(error);
        response.message = message;
        return response;
    }

    public ApiResponse<T> withInstanceId(String instanceId) {
        this.instanceId = instanceId;
        return this;
    }

    public ApiResponse<T> withRequestId(String requestId) {
        this.requestId = requestId;
        return this;
    }

    public ApiResponse<T> withDuration(long durationMs) {
        this.durationMs = durationMs;
        return this;
    }

    public ApiResponse<T> withMeta(Map<String, Object> meta) {
        this.meta = meta;
        return this;
    }

    // Getters
    public boolean isSuccess() { return success; }
    public T getData() { return data; }
    public String getMessage() { return message; }
    public String getError() { return error; }
    public String getInstanceId() { return instanceId; }
    public String getRequestId() { return requestId; }
    public Instant getTimestamp() { return timestamp; }
    public Long getDurationMs() { return durationMs; }
    public Map<String, Object> getMeta() { return meta; }
}
