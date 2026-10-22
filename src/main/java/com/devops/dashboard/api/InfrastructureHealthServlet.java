package com.devops.dashboard.api;

import com.devops.dashboard.dto.ApiResponse;
import com.devops.dashboard.monitoring.InfrastructureHealthSnapshot;
import com.devops.dashboard.monitoring.InfrastructureMonitoringService;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.LinkedHashMap;

/** GET /api/infrastructure/health - cached real health observations for all seven VMs. */
@WebServlet(urlPatterns = "/api/infrastructure/health")
public class InfrastructureHealthServlet extends BaseServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        InfrastructureMonitoringService service = getService("infrastructureMonitoringService");
        if (service == null) {
            writeError(resp, 503, "Infrastructure monitoring is unavailable");
            return;
        }
        InfrastructureHealthSnapshot snapshot = service.markStaleIfNeeded(service.getSnapshot());
        var data = new LinkedHashMap<String, Object>();
        data.put("checkedAt", snapshot.checkedAt());
        data.put("monitoringEnabled", snapshot.monitoringEnabled());
        data.put("stale", snapshot.stale());
        data.put("services", snapshot.services().stream().map(item -> item.toSafeMap()).toList());
        writeApiResponse(resp, 200, ApiResponse.success(data));
    }
}
