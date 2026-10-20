package com.devops.dashboard.api;

import com.devops.dashboard.dto.CreateRecordRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import java.io.BufferedReader;
import java.io.StringReader;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BaseServletTest {
    private final TestServlet servlet = new TestServlet();

    @Test
    void readJson_parsesValidRequest() throws Exception {
        CreateRecordRequest request = servlet.parseRequest("{\"name\":\"demo\"}");

        assertEquals("demo", request.getName());
    }

    @Test
    void readJson_rejectsMalformedJson() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> servlet.parseRequest("{"));
    }

    @Test
    void readJson_rejectsEmptyAndNullBodies() throws Exception {
        assertThrows(IllegalArgumentException.class, () -> servlet.parseRequest(""));
        assertThrows(IllegalArgumentException.class, () -> servlet.parseRequest("null"));
    }

    @Test
    void readJson_rejectsOversizedBodies() throws Exception {
        String oversizedBody = "\"" + "x".repeat(16_384) + "\"";

        assertThrows(IllegalArgumentException.class, () -> servlet.parseRequest(oversizedBody));
    }

    private static final class TestServlet extends BaseServlet {
        CreateRecordRequest parseRequest(String body) throws Exception {
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getReader()).thenReturn(new BufferedReader(new StringReader(body)));
            return readJson(request, CreateRecordRequest.class);
        }
    }
}
