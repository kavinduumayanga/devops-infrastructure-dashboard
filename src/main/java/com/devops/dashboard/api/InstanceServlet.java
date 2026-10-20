package com.devops.dashboard.api;

import com.devops.dashboard.dto.ApiResponse;
import com.devops.dashboard.service.InstanceService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

/**
 * GET /api/instance - Returns current instance identification and runtime info.
 */
@WebServlet(urlPatterns = "/api/instance")
public class InstanceServlet extends BaseServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            InstanceService service = getService("instanceService");
            Map<String, Object> info = service.getInstanceInfo();
            info.put("servletContainerInfo", getServletContext().getServerInfo());
            writeApiResponse(resp, 200, ApiResponse.success(info));
        } catch (Exception e) {
            log.error("Failed to get instance info: {}", e.getMessage());
            writeError(resp, 500, "Failed to retrieve instance information");
        }
    }
}
