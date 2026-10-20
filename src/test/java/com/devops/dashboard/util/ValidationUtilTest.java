package com.devops.dashboard.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ValidationUtilTest {

    @Test
    void sanitize_removesHtmlTags() {
        assertEquals("Hello World", ValidationUtil.sanitize("<b>Hello</b> <i>World</i>"));
    }

    @Test
    void sanitize_trimsWhitespace() {
        assertEquals("test", ValidationUtil.sanitize("  test  "));
    }

    @Test
    void sanitize_returnsNullForNull() {
        assertNull(ValidationUtil.sanitize(null));
    }

    @Test
    void requireNonBlank_throwsOnNull() {
        assertThrows(IllegalArgumentException.class,
                () -> ValidationUtil.requireNonBlank(null, "field"));
    }

    @Test
    void requireNonBlank_throwsOnBlank() {
        assertThrows(IllegalArgumentException.class,
                () -> ValidationUtil.requireNonBlank("   ", "field"));
    }

    @Test
    void requireNonBlank_acceptsValidString() {
        assertDoesNotThrow(() -> ValidationUtil.requireNonBlank("valid", "field"));
    }

    @Test
    void requireMaxLength_throwsOnExceed() {
        assertThrows(IllegalArgumentException.class,
                () -> ValidationUtil.requireMaxLength("abcdef", 3, "field"));
    }

    @Test
    void requireMaxLength_acceptsWithinLimit() {
        assertDoesNotThrow(() -> ValidationUtil.requireMaxLength("abc", 5, "field"));
    }

    @Test
    void requireMaxLength_acceptsNull() {
        assertDoesNotThrow(() -> ValidationUtil.requireMaxLength(null, 5, "field"));
    }

    @Test
    void parsePositiveId_parsesValidId() {
        assertEquals(42L, ValidationUtil.parsePositiveId("42", "id"));
    }

    @Test
    void parsePositiveId_throwsOnZero() {
        assertThrows(IllegalArgumentException.class,
                () -> ValidationUtil.parsePositiveId("0", "id"));
    }

    @Test
    void parsePositiveId_throwsOnNegative() {
        assertThrows(IllegalArgumentException.class,
                () -> ValidationUtil.parsePositiveId("-1", "id"));
    }

    @Test
    void parsePositiveId_throwsOnNonNumeric() {
        assertThrows(IllegalArgumentException.class,
                () -> ValidationUtil.parsePositiveId("abc", "id"));
    }
}
