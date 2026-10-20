package com.devops.dashboard.util;

import com.devops.dashboard.dto.ApiResponse;
import com.devops.dashboard.model.DemoRecord;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JsonUtilTest {

    @Test
    void toJson_serializesObject() {
        Map<String, String> data = Map.of("key", "value");
        String json = JsonUtil.toJson(data);
        assertNotNull(json);
        assertTrue(json.contains("\"key\""));
        assertTrue(json.contains("\"value\""));
    }

    @Test
    void fromJson_deserializesObject() {
        String json = "{\"name\":\"test\",\"description\":\"desc\"}";
        DemoRecord record = JsonUtil.fromJson(json, DemoRecord.class);
        assertNotNull(record);
        assertEquals("test", record.getName());
        assertEquals("desc", record.getDescription());
    }

    @Test
    void toJson_handlesInstant() {
        DemoRecord record = new DemoRecord(1L, "test", "desc", Instant.parse("2024-01-15T10:30:00Z"));
        String json = JsonUtil.toJson(record);
        assertNotNull(json);
        assertTrue(json.contains("2024-01-15"));
        // Should serialize as ISO string, not timestamp number
        assertFalse(json.matches(".*\"createdAt\"\\s*:\\s*\\d+.*"), "Instant should not be serialized as number");
    }

    @Test
    void apiResponse_success_serializesCorrectly() {
        ApiResponse<String> response = ApiResponse.success("data", "OK");
        String json = JsonUtil.toJson(response);
        assertTrue(json.contains("\"success\":true"));
        assertTrue(json.contains("\"data\":\"data\""));
        assertTrue(json.contains("\"message\":\"OK\""));
    }

    @Test
    void apiResponse_error_serializesCorrectly() {
        ApiResponse<Void> response = ApiResponse.error("Something went wrong");
        String json = JsonUtil.toJson(response);
        assertTrue(json.contains("\"success\":false"));
        assertTrue(json.contains("\"error\":\"Something went wrong\""));
    }

    @Test
    void apiResponse_nullFieldsExcluded() {
        ApiResponse<String> response = ApiResponse.success("data");
        String json = JsonUtil.toJson(response);
        // null fields should be excluded due to @JsonInclude(NON_NULL)
        assertFalse(json.contains("\"error\""));
        assertFalse(json.contains("\"message\""));
    }

    @Test
    void fromJson_throwsOnInvalidJson() {
        assertThrows(RuntimeException.class, () -> JsonUtil.fromJson("invalid", DemoRecord.class));
    }
}
