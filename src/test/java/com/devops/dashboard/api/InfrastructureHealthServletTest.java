package com.devops.dashboard.api;

import com.devops.dashboard.monitoring.*;
import com.devops.dashboard.util.JsonUtil;
import jakarta.servlet.ServletConfig;
import jakarta.servlet.ServletContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InfrastructureHealthServletTest {
    @Test void returnsUsableResponseWhenOneProbeFails() throws Exception {
        var good = new FunctionalProbe("web01", "Nginx", "HTTP", () ->
                new ServiceHealth("web01", "Nginx", HealthStatus.UP, "HTTP", 3L,
                        Instant.now(), null, null, Map.of("httpStatus", 200)));
        var bad = new FunctionalProbe("rmq01", "RabbitMQ", "MANAGEMENT_HTTP", () -> {
            throw new IllegalStateException("refused");
        });
        try (var monitoring = new InfrastructureMonitoringService(List.of(good, bad), true,
                Duration.ofSeconds(15), Duration.ofMillis(200))) {
            ServletContext context = mock(ServletContext.class);
            when(context.getAttribute("infrastructureMonitoringService")).thenReturn(monitoring);
            ServletConfig config = mock(ServletConfig.class);
            when(config.getServletContext()).thenReturn(context);
            InfrastructureHealthServlet servlet = new InfrastructureHealthServlet();
            servlet.init(config);

            StringWriter body = new StringWriter();
            HttpServletResponse response = mock(HttpServletResponse.class);
            when(response.getWriter()).thenReturn(new PrintWriter(body));
            servlet.doGet(mock(HttpServletRequest.class), response);

            verify(response).setStatus(200);
            var json = JsonUtil.getMapper().readTree(body.toString());
            assertTrue(json.path("success").asBoolean());
            assertEquals(2, json.path("data").path("services").size());
            assertEquals("DOWN", json.path("data").path("services").get(1).path("status").asText());
        }
    }
}
