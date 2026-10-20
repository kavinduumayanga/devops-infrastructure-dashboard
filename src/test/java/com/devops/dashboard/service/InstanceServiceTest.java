package com.devops.dashboard.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class InstanceServiceTest {

    private InstanceService instanceService;

    @BeforeEach
    void setUp() {
        instanceService = new InstanceService();
    }

    @Test
    void getInstanceInfo_returnsRequiredFields() {
        Map<String, Object> info = instanceService.getInstanceInfo();

        assertNotNull(info);
        assertTrue(info.containsKey("instanceId"));
        assertTrue(info.containsKey("hostname"));
        assertTrue(info.containsKey("javaVersion"));
        assertTrue(info.containsKey("status"));
        assertTrue(info.containsKey("timestamp"));
        assertTrue(info.containsKey("uptime"));
        assertTrue(info.containsKey("uptimeMs"));

        assertEquals("UP", info.get("status"));
        assertNotNull(info.get("javaVersion"));
        assertNotNull(info.get("hostname"));
    }

    @Test
    void getInstanceInfo_javaVersionIsNotEmpty() {
        Map<String, Object> info = instanceService.getInstanceInfo();
        String javaVersion = (String) info.get("javaVersion");
        assertNotNull(javaVersion);
        assertFalse(javaVersion.isBlank());
    }

    @Test
    void getInstanceInfo_uptimeIsPositive() {
        Map<String, Object> info = instanceService.getInstanceInfo();
        long uptimeMs = (long) info.get("uptimeMs");
        assertTrue(uptimeMs >= 0, "Uptime should be non-negative");
    }

    @Test
    void getSystemInfo_returnsRequiredFields() {
        Map<String, Object> info = instanceService.getSystemInfo();

        assertNotNull(info);
        assertTrue(info.containsKey("osName"));
        assertTrue(info.containsKey("osArch"));
        assertTrue(info.containsKey("javaVersion"));
        assertTrue(info.containsKey("heapUsedMB"));
        assertTrue(info.containsKey("heapMaxMB"));
        assertTrue(info.containsKey("availableProcessors"));
    }

    @Test
    void getSystemInfo_processorsIsPositive() {
        Map<String, Object> info = instanceService.getSystemInfo();
        int processors = (int) info.get("availableProcessors");
        assertTrue(processors > 0);
    }

    @Test
    void getSystemInfo_memoryValuesAreReasonable() {
        Map<String, Object> info = instanceService.getSystemInfo();
        long heapUsed = (long) info.get("heapUsedMB");
        long heapMax = (long) info.get("heapMaxMB");

        assertTrue(heapUsed >= 0, "Heap used should be non-negative");
        assertTrue(heapMax > 0, "Heap max should be positive");
        assertTrue(heapUsed <= heapMax, "Heap used should not exceed max");
    }

    @Test
    void getSystemInfo_doesNotExposeJavaHome() {
        Map<String, Object> info = instanceService.getSystemInfo();
        String javaHome = (String) info.get("javaHome");
        assertEquals("***REDACTED***", javaHome, "Java home should be redacted for security");
    }
}
