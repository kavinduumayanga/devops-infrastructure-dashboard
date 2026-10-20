package com.devops.dashboard.util;

/**
 * Input validation utilities.
 */
public final class ValidationUtil {

    private ValidationUtil() {}

    /**
     * Validates and sanitizes a string field.
     */
    public static String sanitize(String input) {
        if (input == null) return null;
        // Strip HTML tags and trim
        return input.replaceAll("<[^>]*>", "").trim();
    }

    /**
     * Validates a required string field.
     */
    public static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required and cannot be blank");
        }
    }

    /**
     * Validates string length.
     */
    public static void requireMaxLength(String value, int maxLength, String fieldName) {
        if (value != null && value.length() > maxLength) {
            throw new IllegalArgumentException(fieldName + " must not exceed " + maxLength + " characters");
        }
    }

    /**
     * Validates a positive long ID.
     */
    public static long parsePositiveId(String value, String fieldName) {
        try {
            long id = Long.parseLong(value);
            if (id <= 0) {
                throw new IllegalArgumentException(fieldName + " must be a positive number");
            }
            return id;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid " + fieldName + ": " + value);
        }
    }
}
