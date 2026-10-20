package com.devops.dashboard.api;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.InputStream;

/**
 * Serves the React SPA for all non-API, non-static routes.
 * Enables client-side routing by forwarding to index.html.
 */
@WebServlet(urlPatterns = {"", "/app/*"})
public class SpaServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        // Serve index.html for SPA routes
        try (InputStream is = getServletContext().getResourceAsStream("/index.html")) {
            if (is != null) {
                resp.setContentType("text/html");
                resp.setCharacterEncoding("UTF-8");
                is.transferTo(resp.getOutputStream());
            } else {
                resp.sendError(HttpServletResponse.SC_NOT_FOUND, "Application not found");
            }
        }
    }
}
