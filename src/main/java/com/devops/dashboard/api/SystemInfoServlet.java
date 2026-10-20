package com.devops.dashboard.api;

import com.devops.dashboard.dto.ApiResponse;
import com.devops.dashboard.service.InstanceService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Map;

/**
 * GET /api/system - Returns detailed system information.
 */
@WebServlet(urlPatterns = "/api/system")
public class SystemInfoServlet extends BaseServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            InstanceService service = getService("instanceService");
            Map<String, Object> info = service.getSystemInfo();

            // Add servlet container info if available
            info.put("servletContainerInfo", getServletContext().getServerInfo());
            info.put("servletApiVersion", getServletContext().getMajorVersion() + "." + getServletContext().getMinorVersion());

            writeApiResponse(resp, 200, ApiResponse.success(info));
        } catch (Exception e) {
            log.error("Failed to get system info: {}", e.getMessage());
            writeError(resp, 500, "Failed to retrieve system information");
        }
    }
}
