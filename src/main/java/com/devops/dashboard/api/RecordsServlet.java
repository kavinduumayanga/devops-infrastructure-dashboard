package com.devops.dashboard.api;

import com.devops.dashboard.dto.ApiResponse;
import com.devops.dashboard.dto.CreateRecordRequest;
import com.devops.dashboard.model.DemoRecord;
import com.devops.dashboard.repository.RecordRepository;
import com.devops.dashboard.service.CacheDemoService;
import com.devops.dashboard.util.ValidationUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.List;

/**
 * REST API for demo records.
 * GET    /api/records      - List all records
 * POST   /api/records      - Create a new record
 * DELETE /api/records/{id}  - Delete a record
 */
@WebServlet(urlPatterns = "/api/records/*")
public class RecordsServlet extends BaseServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            RecordRepository repository = getService("recordRepository");
            long start = System.nanoTime();
            List<DemoRecord> records = repository.findAll();
            long durationMs = (System.nanoTime() - start) / 1_000_000;

            writeApiResponse(resp, 200, ApiResponse.success(records, "Fetched " + records.size() + " records")
                    .withDuration(durationMs));
        } catch (Exception e) {
            log.error("Failed to fetch records: {}", e.getMessage());
            writeError(resp, 500, "Failed to fetch records from database");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            CreateRecordRequest body = readJson(req, CreateRecordRequest.class);

            // Validate
            String name = ValidationUtil.sanitize(body.getName());
            String description = ValidationUtil.sanitize(body.getDescription());

            ValidationUtil.requireNonBlank(name, "name");
            ValidationUtil.requireMaxLength(name, 150, "name");
            if (description != null) {
                ValidationUtil.requireMaxLength(description, 500, "description");
            }

            RecordRepository repository = getService("recordRepository");
            long start = System.nanoTime();
            DemoRecord created = repository.create(name, description);
            long durationMs = (System.nanoTime() - start) / 1_000_000;

            // Invalidate cache when records change
            try {
                CacheDemoService cacheDemoService = getService("cacheDemoService");
                if (!cacheDemoService.invalidateCache()) {
                    log.warn("Demo cache invalidation did not complete after record creation");
                }
            } catch (Exception e) {
                log.warn("Failed to invalidate cache after record creation: {}", e.getMessage());
            }

            writeApiResponse(resp, 201, ApiResponse.success(created, "Record created successfully")
                    .withDuration(durationMs));
        } catch (IllegalArgumentException e) {
            writeError(resp, 400, e.getMessage());
        } catch (Exception e) {
            log.error("Failed to create record: {}", e.getMessage());
            writeError(resp, 500, "Failed to create record");
        }
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        try {
            String pathParam = getPathParam(req);
            if (pathParam == null || pathParam.isBlank()) {
                writeError(resp, 400, "Record ID is required");
                return;
            }

            long id = ValidationUtil.parsePositiveId(pathParam, "id");

            RecordRepository repository = getService("recordRepository");
            long start = System.nanoTime();
            boolean deleted = repository.delete(id);
            long durationMs = (System.nanoTime() - start) / 1_000_000;

            if (deleted) {
                // Invalidate cache when records change
                try {
                    CacheDemoService cacheDemoService = getService("cacheDemoService");
                    if (!cacheDemoService.invalidateCache()) {
                        log.warn("Demo cache invalidation did not complete after record deletion");
                    }
                } catch (Exception e) {
                    log.warn("Failed to invalidate cache after record deletion: {}", e.getMessage());
                }

                writeApiResponse(resp, 200, ApiResponse.<Void>success(null, "Record deleted successfully")
                        .withDuration(durationMs));
            } else {
                writeError(resp, 404, "Record not found with ID: " + id);
            }
        } catch (IllegalArgumentException e) {
            writeError(resp, 400, e.getMessage());
        } catch (Exception e) {
            log.error("Failed to delete record: {}", e.getMessage());
            writeError(resp, 500, "Failed to delete record");
        }
    }
}
